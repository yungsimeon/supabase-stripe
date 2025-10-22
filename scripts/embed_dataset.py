#!/usr/bin/env python3
"""
Embed Supabase RLS troubleshooting dataset into FAISS vector database.

Usage:
    pip install faiss-cpu sentence-transformers ujson numpy
    python embed_dataset.py
"""

import ujson as json
import faiss
import numpy as np
import re
from sentence_transformers import SentenceTransformer
from pathlib import Path

# --- Configuration ---
DATASET_PATH = "dataset/dataset.jsonl"
MODEL_NAME = "intfloat/multilingual-e5-large"  
MAX_POLICY_CHARS = 2000
BATCH_SIZE = 32

# --- Load dataset ---
print(f"📂 Loading dataset from {DATASET_PATH}...")
rows = []
with open(DATASET_PATH, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            rows.append(json.loads(line))

print(f"✓ Loaded {len(rows)} records")

# --- Helper: build embedding text ---
def build_embed_text(row, max_policy_chars=MAX_POLICY_CHARS):
    """Build compact textual representation for embedding."""
    parts = []
    
    # ID and metadata
    parts.append(f"id: {row.get('id', '')}")
    parts.append(f"provider: {row.get('provider', '')}")
    parts.append(f"doc_type: {row.get('doc_type', '')}")
    
    # Tags (important for filtering)
    tags = row.get('tags', [])
    if tags:
        parts.append(f"tags: {','.join(tags)}")
    
    # Summary (most important signal)
    summary = row.get('summary', {}).get('embedding_text', '')
    if summary:
        parts.append(f"summary: {summary}")
    
    # Context information
    context = row.get('context', {})
    if context:
        table = context.get('table', '')
        if table:
            parts.append(f"table: {table}")
        
        symptoms = context.get('symptoms', [])
        if symptoms:
            parts.append(f"symptoms: {' | '.join(symptoms)}")
        
        error = context.get('observed_error', '')
        if error:
            # Truncate long error messages
            error_short = error[:500] if len(error) > 500 else error
            parts.append(f"error: {error_short}")
    
    # Bad policies (what NOT to do)
    bad_policies = row.get('bad_policies', [])
    if bad_policies:
        for i, policy in enumerate(bad_policies[:3], 1):  # Limit to first 3
            policy_name = policy.get('name', '')
            why_bad = policy.get('why_bad', '')
            parts.append(f"bad_policy_{i}: {policy_name} - {why_bad}")
    
    # Good pattern (the solution)
    good_pattern = row.get('good_pattern', {})
    if good_pattern:
        title = good_pattern.get('title', '')
        if title:
            parts.append(f"solution: {title}")
        
        why_good = good_pattern.get('why_good', [])
        if why_good:
            parts.append(f"benefits: {' | '.join(why_good[:3])}")  # Limit to first 3
    
    # Migration steps (brief)
    migration = row.get('migration_steps', [])
    if migration:
        steps_text = ' -> '.join(migration[:3])  # First 3 steps
        parts.append(f"fix_steps: {steps_text}")
    
    # Lint rules for pattern matching
    lint_rules = row.get('lint_rules', [])
    if lint_rules:
        for rule in lint_rules[:2]:  # First 2 rules
            rule_id = rule.get('id', '')
            desc = rule.get('description', '')
            if rule_id:
                parts.append(f"lint_rule: {rule_id} - {desc}")
    
    return "\n".join(parts).strip()

# --- Build corpus ---
print("📝 Building embedding corpus...")
corpus_texts = [build_embed_text(r) for r in rows]
print(f"✓ Built {len(corpus_texts)} embedding texts")

# --- Load embedding model ---
print(f"🤖 Loading embedding model: {MODEL_NAME}...")
model = SentenceTransformer(MODEL_NAME)
print(f"✓ Model loaded (dimension: {model.get_sentence_embedding_dimension()})")

# --- E5 requires "query: " / "passage: " prefixes for best results ---
def encode_passages(texts):
    """Encode passages with E5 prefix."""
    return model.encode(
        [f"passage: {t}" for t in texts],
        normalize_embeddings=True,
        batch_size=BATCH_SIZE,
        show_progress_bar=True
    )

def encode_query(q):
    """Encode query with E5 prefix."""
    return model.encode([f"query: {q}"], normalize_embeddings=True)[0]

# --- Generate embeddings ---
print("🔢 Generating embeddings...")
embs = encode_passages(corpus_texts).astype("float32")
dim = embs.shape[1]
print(f"✓ Generated embeddings shape: {embs.shape}")

# --- Build FAISS index ---
print("🗄️  Building FAISS index...")
index = faiss.IndexFlatIP(dim)  # using cosine via normalized vectors (inner product)
index.add(embs)
print(f"✓ FAISS index built with {index.ntotal} vectors")

# --- Hold metadata for retrieval ---
print("📋 Building metadata store...")
meta = []
for r, text in zip(rows, corpus_texts):
    # Store the full record with all fields for retrieval
    meta.append({
        "id": r.get("id"),
        "provider": r.get("provider"),
        "doc_type": r.get("doc_type", "blueprint-fix"),
        "tags": r.get("tags", []),
        "summary": r.get("summary", {}).get("embedding_text", ""),
        "context": r.get("context", {}),
        "bad_policies": r.get("bad_policies", []),
        "related_issues": r.get("related_issues", []),
        "good_pattern": r.get("good_pattern", {}),
        "migration_steps": r.get("migration_steps", []),
        "canary_tests": r.get("canary_tests", []),
        "lint_rules": r.get("lint_rules", []),
        "artifacts": r.get("artifacts", {}),
        "raw_for_debug": text[:500] + "..." if len(text) > 500 else text  # truncated for debugging
    })

print(f"✓ Metadata store built with {len(meta)} entries")



# --- Save index and metadata ---
print("💾 Saving FAISS index and metadata...")
faiss.write_index(index, "dataset/rls_faiss.index")

with open("dataset/rls_metadata.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)

print("✓ Saved FAISS index to dataset/rls_faiss.index")
print("✓ Saved metadata to dataset/rls_metadata.json")

