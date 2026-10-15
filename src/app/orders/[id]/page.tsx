import { OrderConfirmation } from "@/components/orders/OrderConfirmation";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderConfirmation key={id} id={id} />;
}
