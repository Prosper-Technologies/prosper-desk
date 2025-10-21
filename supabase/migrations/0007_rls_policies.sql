-- Row Level Security Policies for BlueDesk
-- This migration creates comprehensive RLS policies for all tables

-- Helper function to get user's company memberships
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id
  FROM memberships
  WHERE user_id = (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  )
  AND is_active = true;
$$;

-- Helper function to check if user has specific role in company
CREATE OR REPLACE FUNCTION public.user_has_role(company_uuid uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    JOIN users u ON m.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
    AND m.company_id = company_uuid
    AND m.is_active = true
    AND (
      m.role::text = required_role
      OR (required_role = 'admin' AND m.role::text = 'owner')
      OR (required_role = 'agent' AND m.role::text IN ('owner', 'admin'))
    )
  );
$$;

-- Helper function to get current user's id from auth
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid();
$$;

--------------------------------------------------------------------------------
-- COMPANIES TABLE
--------------------------------------------------------------------------------

-- Users can view companies they are members of
CREATE POLICY "Users can view their companies"
ON companies FOR SELECT
USING (id IN (SELECT public.user_company_ids()));

-- Only owners can update company settings
CREATE POLICY "Owners can update companies"
ON companies FOR UPDATE
USING (public.user_has_role(id, 'owner'))
WITH CHECK (public.user_has_role(id, 'owner'));

-- Only owners can delete companies
CREATE POLICY "Owners can delete companies"
ON companies FOR DELETE
USING (public.user_has_role(id, 'owner'));

-- System/service role can create companies (handled in app logic)
CREATE POLICY "Service role can insert companies"
ON companies FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

--------------------------------------------------------------------------------
-- USERS TABLE
--------------------------------------------------------------------------------

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (auth_user_id = auth.uid());

-- Users can view other users in their companies
CREATE POLICY "Users can view company members"
ON users FOR SELECT
USING (
  id IN (
    SELECT m.user_id
    FROM memberships m
    WHERE m.company_id IN (SELECT public.user_company_ids())
  )
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Service role can insert users (during signup)
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth_user_id = auth.uid());

--------------------------------------------------------------------------------
-- MEMBERSHIPS TABLE
--------------------------------------------------------------------------------

-- Users can view memberships in their companies
CREATE POLICY "Users can view company memberships"
ON memberships FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Owners and admins can create memberships
CREATE POLICY "Admins can create memberships"
ON memberships FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

-- Owners and admins can update memberships (except their own role)
CREATE POLICY "Admins can update memberships"
ON memberships FOR UPDATE
USING (public.user_has_role(company_id, 'admin'))
WITH CHECK (
  public.user_has_role(company_id, 'admin')
  AND NOT (user_id = public.current_user_id() AND role != (SELECT role FROM memberships WHERE id = memberships.id))
);

-- Owners can delete memberships (except their own)
CREATE POLICY "Owners can delete memberships"
ON memberships FOR DELETE
USING (
  public.user_has_role(company_id, 'owner')
  AND user_id != public.current_user_id()
);

--------------------------------------------------------------------------------
-- CLIENTS TABLE
--------------------------------------------------------------------------------

-- All company members can view clients
CREATE POLICY "Company members can view clients"
ON clients FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Admins can manage clients
CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can update clients"
ON clients FOR UPDATE
USING (public.user_has_role(company_id, 'admin'))
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

--------------------------------------------------------------------------------
-- TICKETS TABLE
--------------------------------------------------------------------------------

-- Company members can view tickets in their company
CREATE POLICY "Company members can view tickets"
ON tickets FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- All company members can create tickets
CREATE POLICY "Company members can create tickets"
ON tickets FOR INSERT
WITH CHECK (company_id IN (SELECT public.user_company_ids()));

-- Agents can update tickets in their company
CREATE POLICY "Agents can update tickets"
ON tickets FOR UPDATE
USING (company_id IN (SELECT public.user_company_ids()))
WITH CHECK (company_id IN (SELECT public.user_company_ids()));

-- Admins can delete tickets
CREATE POLICY "Admins can delete tickets"
ON tickets FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

-- Service role can insert tickets (for email integration, API, etc.)
CREATE POLICY "Service role can manage tickets"
ON tickets FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

--------------------------------------------------------------------------------
-- TICKET COMMENTS TABLE
--------------------------------------------------------------------------------

-- Company members can view comments on tickets they can access
CREATE POLICY "Company members can view ticket comments"
ON ticket_comments FOR SELECT
USING (
  company_id IN (SELECT public.user_company_ids())
  AND (
    is_internal = false
    OR public.user_has_role(company_id, 'agent')
  )
);

-- Company members can create comments
CREATE POLICY "Company members can create comments"
ON ticket_comments FOR INSERT
WITH CHECK (
  company_id IN (SELECT public.user_company_ids())
  AND ticket_id IN (SELECT id FROM tickets WHERE company_id = ticket_comments.company_id)
);

-- Users can update their own comments (within a time window handled by app)
CREATE POLICY "Users can update own comments"
ON ticket_comments FOR UPDATE
USING (
  company_id IN (SELECT public.user_company_ids())
  AND membership_id IN (
    SELECT id FROM memberships WHERE user_id = public.current_user_id()
  )
)
WITH CHECK (
  company_id IN (SELECT public.user_company_ids())
);

-- Admins can delete comments
CREATE POLICY "Admins can delete comments"
ON ticket_comments FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

-- Service role can manage comments (for email integration)
CREATE POLICY "Service role can manage comments"
ON ticket_comments FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

--------------------------------------------------------------------------------
-- SLA POLICIES TABLE
--------------------------------------------------------------------------------

-- Company members can view SLA policies
CREATE POLICY "Company members can view SLA policies"
ON sla_policies FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Admins can manage SLA policies
CREATE POLICY "Admins can insert SLA policies"
ON sla_policies FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can update SLA policies"
ON sla_policies FOR UPDATE
USING (public.user_has_role(company_id, 'admin'))
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can delete SLA policies"
ON sla_policies FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

--------------------------------------------------------------------------------
-- ESCALATION POLICIES TABLE
--------------------------------------------------------------------------------

-- Company members can view escalation policies
CREATE POLICY "Company members can view escalation policies"
ON escalation_policies FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Admins can manage escalation policies
CREATE POLICY "Admins can insert escalation policies"
ON escalation_policies FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can update escalation policies"
ON escalation_policies FOR UPDATE
USING (public.user_has_role(company_id, 'admin'))
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can delete escalation policies"
ON escalation_policies FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

--------------------------------------------------------------------------------
-- KNOWLEDGE BASE TABLE
--------------------------------------------------------------------------------

-- Company members can view published knowledge base articles
CREATE POLICY "Company members can view knowledge base"
ON knowledge_base FOR SELECT
USING (
  company_id IN (SELECT public.user_company_ids())
  AND (is_published = true OR public.user_has_role(company_id, 'agent'))
);

-- Agents can create knowledge base articles
CREATE POLICY "Agents can create knowledge base articles"
ON knowledge_base FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'agent'));

-- Authors and admins can update articles
CREATE POLICY "Authors can update own knowledge base articles"
ON knowledge_base FOR UPDATE
USING (
  company_id IN (SELECT public.user_company_ids())
  AND (
    author_membership_id IN (
      SELECT id FROM memberships WHERE user_id = public.current_user_id()
    )
    OR public.user_has_role(company_id, 'admin')
  )
)
WITH CHECK (
  company_id IN (SELECT public.user_company_ids())
);

-- Authors and admins can delete articles
CREATE POLICY "Authors can delete own knowledge base articles"
ON knowledge_base FOR DELETE
USING (
  company_id IN (SELECT public.user_company_ids())
  AND (
    author_membership_id IN (
      SELECT id FROM memberships WHERE user_id = public.current_user_id()
    )
    OR public.user_has_role(company_id, 'admin')
  )
);

--------------------------------------------------------------------------------
-- CUSTOMER PORTAL ACCESS TABLE
--------------------------------------------------------------------------------

-- Company members can view portal access for their company
CREATE POLICY "Company members can view portal access"
ON customer_portal_access FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Agents can create portal access
CREATE POLICY "Agents can create portal access"
ON customer_portal_access FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'agent'));

-- Agents can update portal access
CREATE POLICY "Agents can update portal access"
ON customer_portal_access FOR UPDATE
USING (public.user_has_role(company_id, 'agent'))
WITH CHECK (public.user_has_role(company_id, 'agent'));

-- Admins can delete portal access
CREATE POLICY "Admins can delete portal access"
ON customer_portal_access FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

-- Service role can manage portal access (for public portal access via token)
CREATE POLICY "Service role can manage portal access"
ON customer_portal_access FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

--------------------------------------------------------------------------------
-- API KEYS TABLE
--------------------------------------------------------------------------------

-- Company members can view API keys (without the actual key)
CREATE POLICY "Company members can view API keys"
ON api_keys FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Admins can manage API keys
CREATE POLICY "Admins can create API keys"
ON api_keys FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can update API keys"
ON api_keys FOR UPDATE
USING (public.user_has_role(company_id, 'admin'))
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can delete API keys"
ON api_keys FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

--------------------------------------------------------------------------------
-- GMAIL INTEGRATION TABLE
--------------------------------------------------------------------------------

-- Company members can view gmail integrations
CREATE POLICY "Company members can view gmail integrations"
ON gmail_integration FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Admins can manage gmail integrations
CREATE POLICY "Admins can create gmail integrations"
ON gmail_integration FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can update gmail integrations"
ON gmail_integration FOR UPDATE
USING (public.user_has_role(company_id, 'admin'))
WITH CHECK (public.user_has_role(company_id, 'admin'));

CREATE POLICY "Admins can delete gmail integrations"
ON gmail_integration FOR DELETE
USING (public.user_has_role(company_id, 'admin'));

-- Service role can update gmail integrations (for token refresh)
CREATE POLICY "Service role can update gmail integrations"
ON gmail_integration FOR UPDATE
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

--------------------------------------------------------------------------------
-- EMAIL THREADS TABLE
--------------------------------------------------------------------------------

-- Company members can view email threads
CREATE POLICY "Company members can view email threads"
ON email_threads FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Service role can manage email threads (for email integration)
CREATE POLICY "Service role can manage email threads"
ON email_threads FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

--------------------------------------------------------------------------------
-- INVITATION CODES TABLE
--------------------------------------------------------------------------------

-- Company members can view invitation codes for their company
CREATE POLICY "Company members can view invitation codes"
ON invitation_codes FOR SELECT
USING (company_id IN (SELECT public.user_company_ids()));

-- Admins can create invitation codes
CREATE POLICY "Admins can create invitation codes"
ON invitation_codes FOR INSERT
WITH CHECK (public.user_has_role(company_id, 'admin'));

-- Users can update invitation codes when redeeming (mark as used)
CREATE POLICY "Users can redeem invitation codes"
ON invitation_codes FOR UPDATE
USING (user_id = public.current_user_id() AND is_used = false)
WITH CHECK (user_id = public.current_user_id() AND is_used = true);

-- Admins can delete invitation codes
CREATE POLICY "Admins can delete invitation codes"
ON invitation_codes FOR DELETE
USING (public.user_has_role(company_id, 'admin'));
