import BottomNav from "@/components/BottomNav";
import { requireAuth } from "@/lib/auth";

export default async function MainLayout({ children }: LayoutProps<"/">) {
  await requireAuth();
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
