import { cn } from "@/lib/utils";

export function ResponsiveActions({
  children,
  className,
  align = "start"
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 md:flex md:w-auto md:flex-wrap md:items-center",
        "[&>*]:w-full md:[&>*]:w-auto",
        align === "end" && "md:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
