#!/usr/bin/env python3
"""
RAG (Retrieval-Augmented Generation) for Supabase RLS troubleshooting.
Retrieve relevant policy fixes and use them to answer questions with an LLM.
"""

import ujson as json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder, util
import anthropic
import os
from rank_bm25 import BM25Okapi
import re
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
FAISS_INDEX_PATH = "dataset/rls_faiss.index"
METADATA_PATH = "dataset/rls_metadata.json"
MODEL_NAME = "intfloat/multilingual-e5-large"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# --- Load resources ---
print("🔧 Loading resources...")
model = SentenceTransformer(MODEL_NAME)
index = faiss.read_index(FAISS_INDEX_PATH)

with open(METADATA_PATH, "r", encoding="utf-8") as f:
    meta = json.load(f)

print(f"✓ Loaded {index.ntotal} vectors and {len(meta)} metadata entries")

# --- Helper functions ---
def encode_query(q):
    """Encode query with E5 prefix."""
    return model.encode([f"query: {q}"], normalize_embeddings=True)[0]


def search(query, k=5, filters=None):
    """
    Basic semantic search using FAISS.
    Used internally by multiquery_search and hybrid_search.
    """
    query_vec = encode_query(query).astype("float32")
    D, I = index.search(np.array([query_vec]), min(k * 3, len(meta)))
    
    results = []
    for distance, idx in zip(D[0], I[0]):
        if idx == -1:
            continue
        
        result = meta[idx].copy()
        result['score'] = float(distance)
        
        if filters:
            should_include = True
            for key, values in filters.items():
                if key == "doc_type":
                    if result.get("doc_type") not in values:
                        should_include = False
                        break
            if not should_include:
                continue
        
        results.append(result)
        if len(results) >= k:
            break
    
    return results


# load once
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(query, results, top_k=3):
    pairs = [(query, r.get("summary","") or r.get("id","")) for r in results]
    scores = reranker.predict(pairs)  # higher is better
    ranked = sorted(zip(scores, results), key=lambda x:x[0], reverse=True)
    return [r for _, r in ranked[:top_k]]

def multiquery_search(query, k=5, filters=None, n_queries=3, mmr_lambda=0.5, fetch=20):
    # simple paraphrase set (cheap) — replace with an LLM if you want
    variants = [query,
                f"{query} step-by-step",
                f"{query} production-ready code"]

    # collect candidates
    pool = {}
    for v in variants[:n_queries]:
        res = search(v, k=fetch, filters=filters)  # your existing search()
        for r in res:
            pool[r["id"]] = r
    candidates = list(pool.values())
    if not candidates:
        return []

    # MMR over their *vector scores* re-encoded as a matrix
    # For speed we re-embed the summaries (cheap & short).
    texts = [c.get("summary","") or c.get("id","") for c in candidates]
    emb = model.encode([f"passage: {t}" for t in texts], normalize_embeddings=True)
    qv = encode_query(query).astype("float32").reshape(1, -1)

    selected = util.semantic_search(qv, emb, top_k=min(len(candidates), fetch))[0]
    # MMR selection
    selected_ids = []
    selected_vecs = []
    cand_idx = [s["corpus_id"] for s in selected]
    cand_vecs = emb[cand_idx]
    cand_scores = [s["score"] for s in selected]

    while len(selected_ids) < min(k, len(candidates)) and cand_idx:
        if not selected_vecs:
            choice = np.argmax(cand_scores)
        else:
            sim_to_query = np.array(cand_scores)
            sim_to_selected = util.cos_sim(cand_vecs, np.vstack(selected_vecs)).max(dim=1).values.numpy()
            mmr = mmr_lambda * sim_to_query - (1 - mmr_lambda) * sim_to_selected
            choice = int(np.argmax(mmr))
        selected_ids.append(cand_idx[choice])
        selected_vecs.append(cand_vecs[choice:choice+1])
        # remove chosen
        cand_idx.pop(choice); cand_vecs = np.delete(cand_vecs, choice, axis=0); cand_scores.pop(choice)

    return [candidates[i] for i in selected_ids]

# Build once at load time
tokenizer = lambda s: re.findall(r"[a-z0-9_]+", s.lower())
bm25_corpus = [
    " ".join([
        m.get("summary",""),
        " ".join(m.get("tags",[])),
        m.get("context", {}).get("observed_error", ""),
        " ".join([p.get("name", "") for p in m.get("bad_policies", [])]),
        m.get("id","")
    ]) for m in meta
]
bm25 = BM25Okapi([tokenizer(t) for t in bm25_corpus])

def hybrid_search(query, k=5, filters=None, alpha=0.6):
    # vector side
    vec_hits = search(query, k=min(k*5, len(meta)), filters=filters)  # reuse your search()
    vec_ids = {m["id"]: i for i, m in enumerate(vec_hits)}

    # lexical side
    scores = bm25.get_scores(tokenizer(query))
    # normalize
    if scores.max() > 0:
        scores = scores / scores.max()
    # collect candidates (union of top lexical and vector)
    top_lex_idx = np.argsort(scores)[::-1][:min(50, len(scores))]

    union = {m["id"]: m for m in vec_hits}
    for i in top_lex_idx:
        union.setdefault(meta[i]["id"], meta[i])

    # combined score
    combined = []
    qv = encode_query(query).astype("float32")
    D, I = index.search(np.array([qv]), len(meta))
    vec_score_by_idx = {int(ii): float(dd) for dd, ii in zip(D[0], I[0])}

    for m in union.values():
        idx = next(i for i, x in enumerate(meta) if x["id"] == m["id"])
        vec_s = vec_score_by_idx.get(idx, 0.0)
        lex_s = scores[idx]
        final = alpha * vec_s + (1 - alpha) * lex_s
        # small boost for blueprint-fix (complete solutions)
        if m.get("doc_type") == "blueprint-fix":
            final *= 1.05
        combined.append((final, m))
    combined.sort(reverse=True, key=lambda x: x[0])
    return [m for _, m in combined[:k]]


def smart_snippet(text, query, max_chars=2500):
    if len(text) <= max_chars:
        return text
    q = query.lower()
    hit = max(text.lower().find(t) for t in q.split() if t)  # crude signal
    if hit == -1:
        return text[:max_chars]
    start = max(0, hit - max_chars//3)
    end = min(len(text), start + max_chars)
    return text[start:end]

def format_context(results, include_full_details=True, per_result_char_budget=4000, total_budget=15000):
    parts, used = [], 0
    for i, r in enumerate(results, 1):
        # Header
        head = [
            f"### Result {i}: {r['id']}",
            f"**Provider**: {r.get('provider','N/A')} | **Type**: {r.get('doc_type','N/A')}",
            f"**Tags**: {', '.join(r.get('tags', []))}",
            f"**Summary**: {r.get('summary','N/A')}"
        ]
        chunk = "\n".join(head) + "\n"

        # Context section
        context = r.get('context', {})
        if context:
            chunk += f"\n**Context**:\n"
            if context.get('table'):
                chunk += f"- **Table**: `{context['table']}`\n"
            if context.get('symptoms'):
                chunk += f"- **Symptoms**: {', '.join(context['symptoms'])}\n"
            if context.get('observed_error'):
                error = context['observed_error']
                chunk += f"- **Error**: {error[:300] + '...' if len(error) > 300 else error}\n"

        if include_full_details:
            # Bad policies (what NOT to do)
            bad_policies = r.get('bad_policies', [])
            if bad_policies:
                chunk += f"\n**❌ Bad Policies** ({len(bad_policies)} found):\n"
                for j, policy in enumerate(bad_policies[:3], 1):  # Show first 3
                    chunk += f"\n{j}. **{policy.get('name', 'N/A')}** ({policy.get('for', 'N/A')})\n"
                    chunk += f"   - Why bad: {policy.get('why_bad', 'N/A')}\n"
                    if policy.get('sql'):
                        sql = policy['sql']
                        chunk += f"   ```sql\n   {sql[:500]}{'...' if len(sql) > 500 else ''}\n   ```\n"
            
            # Good pattern (the solution)
            good_pattern = r.get('good_pattern', {})
            if good_pattern:
                chunk += f"\n**✅ Solution**: {good_pattern.get('title', 'N/A')}\n"
                
                why_good = good_pattern.get('why_good', [])
                if why_good:
                    chunk += f"**Benefits**:\n"
                    for benefit in why_good[:3]:
                        chunk += f"- {benefit}\n"
                
                # Show SQL fixes
                if good_pattern.get('helper_fn_sql'):
                    chunk += f"\n**Helper Function**:\n```sql\n{good_pattern['helper_fn_sql'][:800]}\n```\n"
                
                if good_pattern.get('consolidated_policy_sql'):
                    chunk += f"\n**Fixed Policy**:\n```sql\n{good_pattern['consolidated_policy_sql'][:800]}\n```\n"
            
            # Migration steps
            migration = r.get('migration_steps', [])
            if migration:
                chunk += f"\n**Migration Steps**:\n"
                for j, step in enumerate(migration[:5], 1):  # First 5 steps
                    chunk += f"{j}. {step}\n"

        chunk += "\n" + "="*80 + "\n"

        if used + len(chunk) > total_budget:
            break
        parts.append(chunk); used += len(chunk)
    return "\n".join(parts)

def generate_answer(query, results, model_name="claude-sonnet-4-5-20250929"):
    """
    Generate an answer using Claude with retrieved context.
    
    Args:
        query: User's question
        results: List of search results
        model_name: Claude model to use
    
    Returns:
        Claude's response
    """
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")
    
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    
    # Format context
    context = format_context(results, include_full_details=True)
    
    # Build prompt
    system_prompt = """You are an expert database engineer specializing in Supabase, PostgreSQL, and Row Level Security (RLS).

You will be provided with:
1. A user's question about RLS policies, errors, or troubleshooting
2. Relevant troubleshooting blueprints with documented patterns, anti-patterns, and fixes

Your task is to:
- Answer the user's question using the provided troubleshooting blueprints
- Explain why certain RLS patterns cause problems (like infinite recursion, self-referencing)
- Provide the correct SQL policies to fix the issue
- Reference specific results by their number (e.g., "Result 1 shows...")
- If the retrieved blueprints don't fully answer the question, say so
- When showing SQL, explain WHY the fix works and what makes it better

Use ONLY the provided results. When you include SQL policies, cite the source like:
`-- from Result 2: RLS fix for organization_members`.

Be concise but thorough. Focus on security, correctness, and avoiding common RLS pitfalls."""

    user_message = f"""# User Question
{query}

# Retrieved Troubleshooting Blueprints
{context}

Please answer the user's question using the troubleshooting blueprints above."""

    # Call Claude
    print(f"\n🤖 Calling Claude ({model_name})...")
    print(f"   Context size: {len(context):,} chars")
    print(f"   Retrieved results: {len(results)}")
    
    response = client.messages.create(
        model=model_name,
        max_tokens=4096,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    
    return response.content[0].text

# --- Interactive CLI ---
def interactive_mode():
    """Run interactive Q&A loop."""
    print("\n" + "="*80)
    print("🔍 RAG Search for Supabase RLS Troubleshooting")
    print("="*80)
    print("\nCommands:")
    print("  - Type a question to search and generate an answer")
    print("  - 'filter <provider>' - Set provider filter (supabase/postgres)")
    print("  - 'clear' - Clear filters")
    print("  - 'exit' or 'quit' - Exit")
    print("="*80 + "\n")
    
    filters = None
    
    while True:
        try:
            user_input = input("\n💬 Question: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() in ("exit", "quit"):
                print("👋 Goodbye!")
                break
            
            if user_input.lower().startswith("filter "):
                provider = user_input[7:].strip()
                if provider in ("supabase", "postgres"):
                    filters = {"provider": [provider]}
                    print(f"✓ Filter set to: {provider}")
                else:
                    print("❌ Invalid filter. Use 'supabase' or 'postgres'")
                continue
            
            if user_input.lower() == "clear":
                filters = None
                print("✓ Filters cleared")
                continue
            
            # Full RAG: hybrid search + rerank + generate
            query = user_input
            print(f"\n🔍 Searching for: '{query}'")
            candidates = hybrid_search(query, k=10, filters=filters)
            results = rerank(query, candidates, top_k=3)    

  
            
            if not results:
                print("❌ No results found. Try a different query or clear filters.")
                continue
            
            print(f"✓ Retrieved {len(results)} relevant troubleshooting blueprints")
            
            # Generate answer
            answer = generate_answer(query, results)
            
            print("\n" + "="*80)
            print("🤖 ANSWER")
            print("="*80)
            print(answer)
            print("="*80)
            
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")

# --- Example queries ---
def run_examples():
    """Run example queries to demonstrate the system."""
    examples = [
        {
            "query": "How do I fix infinite recursion in organization_members RLS policy?",
            "filters": None
        },
        {
            "query": "RLS policy self-referencing error",
            "filters": {"provider": ["supabase"]}
        }
    ]
    
    print("\n" + "="*80)
    print("🧪 RUNNING EXAMPLE QUERIES")
    print("="*80)
    
    for i, example in enumerate(examples, 1):
        print(f"\n{'='*80}")
        print(f"EXAMPLE {i}: {example['query']}")
        print('='*80)
        
        # Use hybrid search + reranking for better results
        candidates = hybrid_search(example['query'], k=10, filters=example.get('filters'))
        results = rerank(example['query'], candidates, top_k=3)
        
        print(f"\n📊 Retrieved {len(results)} results:")
        for j, r in enumerate(results, 1):
            print(f"{j}. {r['id']} ({r.get('doc_type', 'blueprint-fix')})")
        
        if ANTHROPIC_API_KEY:
            answer = generate_answer(example['query'], results)
            print("\n🤖 ANSWER:")
            print(answer)
        else:
            print("\n⚠️  Skipping LLM generation (ANTHROPIC_API_KEY not set)")
        
        print("\n" + "="*80)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--examples":
        run_examples()
    else:
        interactive_mode()

