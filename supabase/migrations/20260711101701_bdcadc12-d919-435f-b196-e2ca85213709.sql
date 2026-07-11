CREATE POLICY "Staff can insert order items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'employee'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );