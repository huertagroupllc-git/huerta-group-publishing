-- Milestone 1 — explicit privileges for the authenticated role
--
-- "permission denied for table authors" (42501) means the API role lacked
-- table-level GRANTs; Row Level Security is evaluated only after these.
-- Grants are stated explicitly rather than relying on the project's default
-- privileges. This does not weaken RLS: row access remains deny-by-default
-- under the Milestone 1 policies, and anon receives nothing.

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on table
    public.authors,
    public.author_documents,
    public.document_versions
  to authenticated;

grant select on table public.active_author_memory to authenticated;

grant execute on function
  public.is_staff(),
  public.owns_author(uuid),
  public.owns_document(uuid),
  public.create_author_with_documents(text, text, text, text),
  public.create_document_version(uuid, text, text, public.import_source, text),
  public.activate_document_version(uuid)
  to authenticated;
