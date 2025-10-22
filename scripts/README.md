# RLS Troubleshooting RAG System

Vector database and RAG system for Supabase/PostgreSQL Row Level Security (RLS) troubleshooting.

## Overview

This system helps you quickly find solutions to RLS policy errors by:

1. Embedding troubleshooting blueprints into a FAISS vector database
2. Using semantic + lexical hybrid search to find relevant fixes
3. Generating answers using Claude with retrieved context

## Setup

### 1. Install Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Prepare Your Dataset

Create troubleshooting records in `dataset/dataset.jsonl`. Each record should follow this structure:

```json
{
  "id": "supabase/rls/table_name/issue-type@YYYY-MM-DD",
  "provider": "supabase",
  "doc_type": "blueprint-fix",
  "tags": ["supabase", "postgres", "rls", "security"],
  "summary": {
    "embedding_text": "Brief description of the issue and fix"
  },
  "context": {
    "table": "public.table_name",
    "symptoms": ["Error messages or behaviors"],
    "observed_error": "Full error message"
  },
  "bad_policies": [
    {
      "name": "Policy name",
      "for": "SELECT",
      "sql": "CREATE POLICY ...",
      "why_bad": "Explanation"
    }
  ],
  "good_pattern": {
    "title": "Solution title",
    "helper_fn_sql": "CREATE FUNCTION ...",
    "consolidated_policy_sql": "CREATE POLICY ...",
    "why_good": ["Benefit 1", "Benefit 2"]
  },
  "migration_steps": ["Step 1", "Step 2"],
  "canary_tests": [...],
  "lint_rules": [...],
  "artifacts": {...}
}
```

## Usage

### Embed the Dataset

First, embed your troubleshooting records into the vector database:

```bash
python embed_dataset.py
```

This will create:

- `dataset/rls_faiss.index` - FAISS vector index
- `dataset/rls_metadata.json` - Metadata store

### Interactive Search

Run the interactive CLI to search and get answers:

```bash
python rag_search.py
```

Example queries:

- "How do I fix infinite recursion in organization_members RLS policy?"
- "RLS policy self-referencing error"
- "Duplicate RLS policies causing conflicts"

### Run Example Queries

Test the system with pre-defined examples:

```bash
python rag_search.py --examples
```

## How It Works

### 1. Embedding (`embed_dataset.py`)

- Loads records from `dataset.jsonl`
- Builds rich text representations including:
  - Summary and context
  - Error messages
  - Bad policies (anti-patterns)
  - Good patterns (solutions)
  - Migration steps
  - Lint rules
- Embeds using `intfloat/multilingual-e5-large`
- Stores vectors in FAISS index

### 2. Search (`rag_search.py`)

Three search strategies:

1. **Basic Semantic Search**: Fast FAISS cosine similarity
2. **Multi-query Search**: Query expansion with MMR diversification
3. **Hybrid Search**: Combines semantic (FAISS) + lexical (BM25)

Results are re-ranked using a cross-encoder for precision.

### 3. Answer Generation

- Retrieved blueprints are formatted with full context
- Claude generates answers using:
  - Error patterns
  - Bad policy examples
  - Good policy patterns
  - Migration steps
  - Why the fix works

## Filters

You can filter results by:

- `provider`: "supabase", "postgres"
- `doc_type`: "blueprint-fix"
- `tags`: Custom tags from your dataset

Example:

```
💬 Question: filter supabase
✓ Filter set to: supabase
```

## Dataset Structure

Your dataset should focus on:

- **Bad patterns**: What causes errors (self-referencing, recursion, conflicts)
- **Good patterns**: How to fix them (SECURITY DEFINER, consolidated policies)
- **Context**: Error messages, symptoms, affected tables
- **Migration**: Step-by-step fixes
- **Testing**: Canary queries to verify fixes

## Tips

1. **Be specific in queries**: Include error messages or table names
2. **Use filters**: Narrow down to specific providers or types
3. **Build comprehensive records**: More context = better results
4. **Test your fixes**: Use the canary_tests from retrieved blueprints
5. **Add new patterns**: Grow your dataset as you encounter new issues

## Architecture

```
dataset/
  dataset.jsonl          # Source troubleshooting records
  rls_faiss.index        # FAISS vector index (generated)
  rls_metadata.json      # Full metadata store (generated)

scripts/
  embed_dataset.py       # Embedding pipeline
  rag_search.py          # Search & generation pipeline
  requirements.txt       # Python dependencies
```

## Performance

- **Embedding**: ~1-2 seconds per record (one-time)
- **Search**: <100ms for hybrid search
- **Re-ranking**: ~50ms for 10 candidates
- **Generation**: 2-5 seconds with Claude Sonnet

## Extending

To add new troubleshooting patterns:

1. Add records to `dataset/dataset.jsonl`
2. Re-run `python embed_dataset.py`
3. Search will automatically use the new records

No code changes needed!
