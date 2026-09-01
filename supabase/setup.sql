-- Digital Aastraa: blog CMS + contact inbox
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- It is safe to re-run after updates; existing content and users are preserved.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.blog_posts (
    id uuid primary key default gen_random_uuid(),
    author_id uuid references auth.users(id) on delete set null,
    title text not null default 'Untitled draft',
    slug text not null unique,
    excerpt text not null default '',
    content jsonb not null default '{"blocks": []}'::jsonb,
    cover_image_url text,
    cover_image_path text,
    author_name text not null default 'Digital Aastraa',
    author_role text,
    author_bio text,
    author_avatar_url text,
    author_avatar_path text,
    tags text[] not null default '{}',
    status text not null default 'draft' check (status in ('draft', 'published')),
    seo_title text,
    seo_description text,
    recommended_post_ids uuid[] not null default '{}',
    recommendation_position text not null default 'bottom' check (recommendation_position in ('bottom', 'sidebar')),
    published_at timestamptz,
    first_published_at timestamptz,
    unpublished_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.blog_assets (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.blog_posts(id) on delete cascade,
    storage_path text not null unique,
    public_url text not null,
    asset_type text not null default 'inline' check (asset_type in ('cover', 'inline', 'author', 'video')),
    mime_type text,
    size_bytes bigint not null default 0 check (size_bytes >= 0),
    original_name text,
    created_at timestamptz not null default now()
);

-- Safe migration when this file is run again on an existing project.
alter table public.blog_posts add column if not exists first_published_at timestamptz;
alter table public.blog_posts add column if not exists unpublished_at timestamptz;
alter table public.blog_posts add column if not exists deleted_at timestamptz;
alter table public.blog_posts add column if not exists recommended_post_ids uuid[] not null default '{}';
alter table public.blog_posts add column if not exists recommendation_position text not null default 'bottom';
alter table public.blog_posts add column if not exists author_role text;
alter table public.blog_posts add column if not exists author_bio text;
alter table public.blog_posts add column if not exists author_avatar_url text;
alter table public.blog_posts add column if not exists author_avatar_path text;
alter table public.blog_assets add column if not exists size_bytes bigint not null default 0;
alter table public.blog_assets add column if not exists original_name text;
alter table public.blog_assets add column if not exists mime_type text;

alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts
    add constraint blog_posts_status_check
    check (status in ('draft', 'published', 'trashed'));

alter table public.blog_posts drop constraint if exists blog_posts_recommendation_position_check;
alter table public.blog_posts
    add constraint blog_posts_recommendation_position_check
    check (recommendation_position in ('bottom', 'sidebar'));

alter table public.blog_posts drop constraint if exists blog_posts_recommended_count_check;
alter table public.blog_posts
    add constraint blog_posts_recommended_count_check
    check (cardinality(recommended_post_ids) <= 3);

alter table public.blog_assets drop constraint if exists blog_assets_asset_type_check;
alter table public.blog_assets
    add constraint blog_assets_asset_type_check
    check (asset_type in ('cover', 'inline', 'author', 'video'));

create table if not exists public.contact_submissions (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text not null,
    email text not null,
    service text not null,
    enquiry_type text not null default 'contact' check (enquiry_type in ('contact', 'audit')),
    newsletter boolean not null default false,
    project_description text not null default '',
    status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
    admin_notes text not null default '',
    lead_source text not null default 'Website',
    utm_source text,
    utm_medium text,
    utm_campaign text,
    landing_page text,
    referrer text,
    next_follow_up_at timestamptz,
    estimated_value numeric(12,2) not null default 0 check (estimated_value >= 0),
    stage_updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.contact_submissions add column if not exists lead_source text not null default 'Website';
alter table public.contact_submissions add column if not exists enquiry_type text not null default 'contact';
alter table public.contact_submissions add column if not exists utm_source text;
alter table public.contact_submissions add column if not exists utm_medium text;
alter table public.contact_submissions add column if not exists utm_campaign text;
alter table public.contact_submissions add column if not exists landing_page text;
alter table public.contact_submissions add column if not exists referrer text;
alter table public.contact_submissions add column if not exists next_follow_up_at timestamptz;
alter table public.contact_submissions add column if not exists estimated_value numeric(12,2) not null default 0;
alter table public.contact_submissions add column if not exists stage_updated_at timestamptz not null default now();

alter table public.contact_submissions drop constraint if exists contact_submissions_enquiry_type_check;
alter table public.contact_submissions
    add constraint contact_submissions_enquiry_type_check
    check (enquiry_type in ('contact', 'audit'));

alter table public.contact_submissions drop constraint if exists contact_submissions_status_check;
update public.contact_submissions set status = 'lost' where status = 'closed';
alter table public.contact_submissions
    add constraint contact_submissions_status_check
    check (status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost'));

alter table public.contact_submissions drop constraint if exists contact_submissions_estimated_value_check;
alter table public.contact_submissions
    add constraint contact_submissions_estimated_value_check
    check (estimated_value >= 0);

create table if not exists public.enquiry_stage_history (
    id bigint generated by default as identity primary key,
    submission_id uuid not null references public.contact_submissions(id) on delete cascade,
    from_status text,
    to_status text not null,
    changed_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists blog_posts_public_idx
    on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_author_idx
    on public.blog_posts (author_id);
create index if not exists blog_assets_post_idx
    on public.blog_assets (post_id);
create index if not exists blog_posts_deleted_idx
    on public.blog_posts (status, deleted_at desc);
create index if not exists contact_submissions_created_idx
    on public.contact_submissions (created_at desc);
create index if not exists contact_submissions_status_idx
    on public.contact_submissions (status);
create index if not exists contact_submissions_follow_up_idx
    on public.contact_submissions (next_follow_up_at) where next_follow_up_at is not null;
create index if not exists enquiry_stage_history_submission_idx
    on public.enquiry_stage_history (submission_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row execute function public.set_updated_at();

drop trigger if exists contact_submissions_set_updated_at on public.contact_submissions;
create trigger contact_submissions_set_updated_at
before update on public.contact_submissions
for each row execute function public.set_updated_at();

create or replace function public.stamp_enquiry_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.status is distinct from old.status then
        new.stage_updated_at = now();
    end if;
    return new;
end;
$$;

drop trigger if exists contact_submissions_stamp_stage on public.contact_submissions;
create trigger contact_submissions_stamp_stage
before update of status on public.contact_submissions
for each row execute function public.stamp_enquiry_stage();

create or replace function public.track_enquiry_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' or new.status is distinct from old.status then
        new.stage_updated_at = now();
        insert into public.enquiry_stage_history (submission_id, from_status, to_status, changed_by)
        values (new.id, case when tg_op = 'UPDATE' then old.status else null end, new.status, auth.uid());
    end if;
    return new;
end;
$$;

drop trigger if exists contact_submissions_track_stage on public.contact_submissions;
create trigger contact_submissions_track_stage
after insert or update of status on public.contact_submissions
for each row execute function public.track_enquiry_stage();

alter table public.admin_users enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_assets enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.enquiry_stage_history enable row level security;

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.blog_posts from anon, authenticated;
revoke all on table public.blog_assets from anon, authenticated;
revoke all on table public.contact_submissions from anon, authenticated;
revoke all on table public.enquiry_stage_history from anon, authenticated;

grant select on table public.blog_posts to anon, authenticated;
grant insert, update, delete on table public.blog_posts to authenticated;
grant select, insert, update, delete on table public.blog_assets to authenticated;
grant select, update, delete on table public.contact_submissions to authenticated;
grant select on table public.enquiry_stage_history to authenticated;

create or replace function public.submit_contact(
    p_name text,
    p_phone text,
    p_email text,
    p_service text,
    p_newsletter boolean,
    p_project_description text,
    p_enquiry_type text,
    p_lead_source text,
    p_utm_source text,
    p_utm_medium text,
    p_utm_campaign text,
    p_landing_page text,
    p_referrer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    clean_name text := trim(coalesce(p_name, ''));
    clean_phone text := trim(coalesce(p_phone, ''));
    clean_email text := lower(trim(coalesce(p_email, '')));
    clean_service text := trim(coalesce(p_service, ''));
    clean_description text := trim(coalesce(p_project_description, ''));
    clean_type text := lower(trim(coalesce(p_enquiry_type, 'contact')));
    clean_source text := trim(coalesce(p_lead_source, 'Website'));
    recent_submissions integer;
    new_submission_id uuid;
begin
    if char_length(clean_name) not between 2 and 120 then
        raise exception 'Please enter a valid name.' using errcode = '22023';
    end if;
    if char_length(clean_phone) not between 7 and 24
        or clean_phone !~ '^[0-9+() -]+$' then
        raise exception 'Please enter a valid phone number.' using errcode = '22023';
    end if;
    if char_length(clean_email) not between 5 and 254
        or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Please enter a valid email address.' using errcode = '22023';
    end if;
    if char_length(clean_service) not between 2 and 80 then
        raise exception 'Please select a valid service.' using errcode = '22023';
    end if;
    if char_length(clean_description) > 5000 then
        raise exception 'The project description is too long.' using errcode = '22023';
    end if;
    if clean_type not in ('contact', 'audit') then
        raise exception 'Invalid enquiry type.' using errcode = '22023';
    end if;
    if char_length(clean_source) not between 1 and 120
        or char_length(coalesce(p_utm_source, '')) > 160
        or char_length(coalesce(p_utm_medium, '')) > 160
        or char_length(coalesce(p_utm_campaign, '')) > 240
        or char_length(coalesce(p_landing_page, '')) > 1000
        or char_length(coalesce(p_referrer, '')) > 1000 then
        raise exception 'Invalid attribution data.' using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(clean_email || '|' || clean_phone, 0)
    );
    select count(*) into recent_submissions
    from public.contact_submissions
    where created_at > now() - interval '1 hour'
      and (lower(email) = clean_email or phone = clean_phone);

    if recent_submissions >= 3 then
        raise exception 'Too many requests. Please try again later.' using errcode = 'P0001';
    end if;

    insert into public.contact_submissions (
        name, phone, email, service, newsletter, project_description,
        enquiry_type, lead_source, utm_source, utm_medium, utm_campaign,
        landing_page, referrer, status, admin_notes, estimated_value
    ) values (
        clean_name, clean_phone, clean_email, clean_service, coalesce(p_newsletter, false),
        clean_description, clean_type, clean_source, nullif(trim(coalesce(p_utm_source, '')), ''),
        nullif(trim(coalesce(p_utm_medium, '')), ''), nullif(trim(coalesce(p_utm_campaign, '')), ''),
        nullif(trim(coalesce(p_landing_page, '')), ''), nullif(trim(coalesce(p_referrer, '')), ''),
        'new', '', 0
    )
    returning id into new_submission_id;

    return new_submission_id;
end;
$$;

revoke all on function public.submit_contact(
    text, text, text, text, boolean, text, text, text,
    text, text, text, text, text
) from public;
grant execute on function public.submit_contact(
    text, text, text, text, boolean, text, text, text,
    text, text, text, text, text
) to anon, authenticated;

create or replace function public.get_admin_resource_usage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
begin
    if not public.is_admin() then
        raise exception 'Not authorized';
    end if;

    select jsonb_build_object(
        'database_bytes', pg_database_size(current_database()),
        'database_limit_bytes', 524288000,
        'storage_bytes', coalesce((
            select sum(
                case
                    when objects.metadata ->> 'size' ~ '^[0-9]+$'
                    then (objects.metadata ->> 'size')::bigint
                    else 0
                end
            )
            from storage.objects as objects
            where objects.bucket_id = 'blog-images'
        ), 0),
        'storage_limit_bytes', 1073741824,
        'media_count', (select count(*) from public.blog_assets),
        'image_count', (select count(*) from public.blog_assets where asset_type <> 'video'),
        'video_count', (select count(*) from public.blog_assets where asset_type = 'video'),
        'media_tracked_bytes', (select coalesce(sum(size_bytes), 0) from public.blog_assets),
        'post_count', (select count(*) from public.blog_posts),
        'published_count', (select count(*) from public.blog_posts where status = 'published'),
        'draft_count', (select count(*) from public.blog_posts where status = 'draft'),
        'trash_count', (select count(*) from public.blog_posts where status = 'trashed'),
        'enquiry_count', (select count(*) from public.contact_submissions),
        'open_enquiry_count', (select count(*) from public.contact_submissions where status not in ('won', 'lost')),
        'won_enquiry_count', (select count(*) from public.contact_submissions where status = 'won'),
        'admin_count', (select count(*) from public.admin_users)
    ) into result;

    return result;
end;
$$;

revoke all on function public.get_admin_resource_usage() from public;
grant execute on function public.get_admin_resource_usage() to authenticated;

drop policy if exists "Published posts are public" on public.blog_posts;
create policy "Published posts are public"
on public.blog_posts for select
to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "Admins can read every post" on public.blog_posts;
create policy "Admins can read every post"
on public.blog_posts for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can create posts" on public.blog_posts;
create policy "Admins can create posts"
on public.blog_posts for insert
to authenticated
with check ((select public.is_admin()) and author_id = (select auth.uid()));

drop policy if exists "Admins can update posts" on public.blog_posts;
create policy "Admins can update posts"
on public.blog_posts for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins can delete posts" on public.blog_posts;
create policy "Admins can delete posts"
on public.blog_posts for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can read blog assets" on public.blog_assets;
create policy "Admins can read blog assets"
on public.blog_assets for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can create blog assets" on public.blog_assets;
create policy "Admins can create blog assets"
on public.blog_assets for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Admins can update blog assets" on public.blog_assets;
create policy "Admins can update blog assets"
on public.blog_assets for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins can delete blog assets" on public.blog_assets;
create policy "Admins can delete blog assets"
on public.blog_assets for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Visitors can submit contact forms" on public.contact_submissions;

drop policy if exists "Admins can read submissions" on public.contact_submissions;
create policy "Admins can read submissions"
on public.contact_submissions for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can update submissions" on public.contact_submissions;
create policy "Admins can update submissions"
on public.contact_submissions for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins can delete submissions" on public.contact_submissions;
create policy "Admins can delete submissions"
on public.contact_submissions for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "Admins can read enquiry history" on public.enquiry_stage_history;
create policy "Admins can read enquiry history"
on public.enquiry_stage_history for select
to authenticated
using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'blog-images',
    'blog-images',
    true,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload blog images" on storage.objects;
create policy "Admins can upload blog images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'blog-images' and (select public.is_admin()));

drop policy if exists "Admins can update blog images" on storage.objects;
create policy "Admins can update blog images"
on storage.objects for update
to authenticated
using (bucket_id = 'blog-images' and (select public.is_admin()))
with check (bucket_id = 'blog-images' and (select public.is_admin()));

drop policy if exists "Admins can delete blog images" on storage.objects;
create policy "Admins can delete blog images"
on storage.objects for delete
to authenticated
using (bucket_id = 'blog-images' and (select public.is_admin()));

-- FINAL ADMIN STEP
-- 1. Dashboard > Authentication > Users > Add user.
-- 2. Copy that user's UUID.
-- 3. Run this after replacing the placeholder:
-- insert into public.admin_users (user_id) values ('YOUR_ADMIN_USER_UUID');

-- Ask PostgREST to refresh its column/table cache immediately.
notify pgrst, 'reload schema';
