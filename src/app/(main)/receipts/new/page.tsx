import PageHeader from "@/components/PageHeader";
import ReceiptForm from "@/components/ReceiptForm";
import { requireAuth } from "@/lib/auth";
import { todayKST } from "@/lib/format";
import { listHospitalNamesByCategory } from "@/lib/receipts";
import { createReceipt } from "../actions";

export default async function NewReceiptPage() {
  await requireAuth();
  return (
    <>
      <PageHeader title="영수증 추가" backHref="/receipts" />
      <ReceiptForm action={createReceipt} hospitals={listHospitalNamesByCategory()} defaultDate={todayKST()} />
    </>
  );
}
