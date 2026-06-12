# Supabase Migrations

Local-first workflow for managing schema changes.

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Project already created on Supabase dashboard

## Link your project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Find the project ref in your Supabase dashboard Settings → General.

## Apply migrations to live DB

```bash
supabase db push
```

Applies all files in `migrations/` that haven't been run yet.

## Create a new migration locally

```bash
supabase migration new add_some_table
```

Edit the generated file, then run `supabase db push` when ready.

## Common commands

| Command | What it does |
|---------|-------------|
| `supabase db push` | Apply all pending migrations to the linked live DB |
| `supabase migration new <name>` | Create a new empty migration file |
| `supabase db diff -f <name>` | Generate a migration from your current local schema changes |
| `supabase status` | Check which migrations have been applied |

**Note:** `db push` is one-way. To pull live changes back to a file, use `supabase db pull`.
