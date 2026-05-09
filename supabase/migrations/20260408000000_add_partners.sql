-- 1. ADD PARTNER COLUMNS TO PROFILES
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partner_commission_percent DECIMAL(5,2) DEFAULT 0.00;

-- 2. CREATE PARTNER COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.partner_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR DEFAULT 'pending', -- 'pending' ou 'paid'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS POLICIES FOR PARTNER COMMISSIONS
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own commissions"
    ON public.partner_commissions FOR SELECT
    USING (auth.uid() = partner_id);

CREATE POLICY "Admins can fully manage partner commissions"
    ON public.partner_commissions
    USING (public.is_admin());

-- 4. TRIGGER FUNCTION FOR UPDATING updated_at
CREATE TRIGGER update_partner_commissions_updated_at
    BEFORE UPDATE ON public.partner_commissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. TRIGGER FOR GENERATING COMMISSIONS ON PAYMENT APPROVAL
CREATE OR REPLACE FUNCTION public.generate_partner_commission()
RETURNS TRIGGER AS $$
DECLARE
    v_referrer_id UUID;
    v_is_partner BOOLEAN;
    v_commission_percent DECIMAL;
    v_commission_amount DECIMAL;
BEGIN
    -- Only act when payment status becomes 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Find if user was referred
        SELECT referrer_id INTO v_referrer_id 
        FROM public.referrals 
        WHERE referred_id = NEW.user_id 
        LIMIT 1;

        IF v_referrer_id IS NOT NULL THEN
            -- Check if referrer is a partner
            SELECT is_partner, partner_commission_percent 
            INTO v_is_partner, v_commission_percent
            FROM public.profiles
            WHERE id = v_referrer_id;

            -- If they are a partner and have a percentage configured
            IF v_is_partner = true AND v_commission_percent > 0 THEN
                -- Calculate commission amount
                v_commission_amount := (NEW.amount_brl * v_commission_percent) / 100.0;

                -- Insert into commissions table
                INSERT INTO public.partner_commissions (
                    partner_id, referred_id, payment_id, amount, status
                ) VALUES (
                    v_referrer_id, NEW.user_id, NEW.id, v_commission_amount, 'pending'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors on reruns
DROP TRIGGER IF EXISTS on_payment_approved_commission ON public.payments;

CREATE TRIGGER on_payment_approved_commission
    AFTER UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.generate_partner_commission();
