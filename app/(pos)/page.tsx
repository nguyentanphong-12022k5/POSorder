import { prisma } from "@/lib/prisma";
import MenuGrid from "@/components/pos/MenuGrid";
import CartPanel from "@/components/pos/CartPanel";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sort: "asc" },
    include: {
      products: {
        where: { isActive: true },
        include: {
          variants: {
            orderBy: { extraPrice: "asc" },
          },
          toppings: {
            include: {
              topping: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-6.5rem)]">
      {/* CỘT TRÁI - Menu món (chiếm 8 cột trên màn lớn) */}
      <div className="lg:col-span-8 xl:col-span-8 flex flex-col h-full overflow-hidden">
        <MenuGrid categories={categories as any} />
      </div>

      {/* CỘT PHẢI - Giỏ hàng (chiếm 4 cột trên màn lớn) */}
      <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-full">
        <CartPanel />
      </div>
    </div>
  );
}
