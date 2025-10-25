create table public.notifications (
  id uuid not null default extensions.uuid_generate_v4 (),
  recipient_id uuid null,
  sender_id uuid null,
  type character varying not null,
  content text not null,
  reference_id uuid null,
  is_read boolean null default false,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  post_id text null,
  constraint notifications_pkey primary key (id),
  constraint notifications_recipient_id_fkey foreign KEY (recipient_id) references auth.users (id) on delete CASCADE,
  constraint notifications_sender_id_fkey foreign KEY (sender_id) references auth.users (id) on delete CASCADE,
  constraint notifications_type_check check (
    (
      (type)::text = any (
        array[
          ('like'::character varying)::text,
          ('comment'::character varying)::text,
          ('follow'::character varying)::text,
          ('mention'::character varying)::text,
          ('follow_request'::character varying)::text,
          ('follow_accepted'::character varying)::text,
          ('person_confession'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists notifications_recipient_id_idx on public.notifications using btree (recipient_id) TABLESPACE pg_default;

create index IF not exists notifications_created_at_idx on public.notifications using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists notifications_post_id_idx on public.notifications using btree (post_id) TABLESPACE pg_default;

create trigger update_notifications_updated_at BEFORE
update on notifications for EACH row
execute FUNCTION update_updated_at_column ();



Policies
Manage Row Level Security policies for your tables

Docs
49396

schema

public

notifications

Disable RLS

Create policy

Name	Command	Applied to	Actions

Users can insert notifications
INSERT	
authenticated


Users can update their own notifications
UPDATE	
public


Users can view their own notifications
SELECT	
public



Policy Name
Users can insert notifications
Table

on clause


public.notifications
Policy Behavior

as clause

permissive
Policy Command

for clause



INSERT

Target Roles

to clause

authenticated
Use options above to edit


alter policy "Users can insert notifications"


on "public"."notifications"


to authenticated


with check (


  ((auth.uid() = sender_id) OR (auth.uid() = recipient_id))

);




Policy Name
Users can update their own notifications
Table

on clause


public.notifications
Policy Behavior

as clause

permissive
Policy Command

for clause




UPDATE

Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can update their own notifications"


on "public"."notifications"


to public


using (


  (auth.uid() = recipient_id)

);


Use check expression




Policy Name
Users can view their own notifications
Table

on clause


public.notifications
Policy Behavior

as clause

permissive
Policy Command

for clause


SELECT






Target Roles

to clause

Defaults to all (public) roles if none selected
Use options above to edit


alter policy "Users can view their own notifications"


on "public"."notifications"


to public


using (


  (auth.uid() = recipient_id)

);