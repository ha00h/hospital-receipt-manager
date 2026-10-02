import { CATEGORY_LABEL, type Category } from "@/db/schema";

export default function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
        category === "hospital" ? "bg-brand-100 text-brand-700" : "bg-orange-100 text-orange-700"
      }`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
