import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ReceiptForm from "@/components/ReceiptForm";
import { requireAuth } from "@/lib/auth";
import { todayKST } from "@/lib/format";
import { getReceipt, listHospitalNames } from "@/lib/receipts";
import { updateReceipt } from "../../actions";

export default async function EditReceiptPage({ params }: PageProps<"/receipts/[id]/edit">) {
  await requireAuth();
  const id = Number((await params).id);
  const receipt = Number.isInteger(id) ? getReceipt(id) : undefined;
  if (!receipt) notFound();

  return (
    <>
      <PageHeader title="영수증 수정" backHref={`/receipts/${id}`} />
      <ReceiptForm
        action={updateReceipt.bind(null, id)}
        hospitals={listHospitalNames()}
        defaultDate={todayKST()}
        receipt={receipt}
      />
    </>
  );
}
