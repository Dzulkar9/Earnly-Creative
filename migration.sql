-- SQL Migration to create ratings table in Supabase
-- Run this in your Supabase Dashboard SQL Editor:

CREATE TABLE IF NOT EXISTS public.project_ratings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id bigint REFERENCES public.projects(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text DEFAULT '',
    buyer_address text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.project_ratings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read reviews
CREATE POLICY "Allow public read access to ratings" 
ON public.project_ratings FOR SELECT 
USING (true);

-- Create policy to allow authenticated/anon users to insert reviews
CREATE POLICY "Allow anyone to insert ratings" 
ON public.project_ratings FOR INSERT 
WITH CHECK (true);
