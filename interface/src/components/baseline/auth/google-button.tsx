import { siGoogle } from "simple-icons";

import { SimpleIcon } from "@/components/derived/simple-icon";
import { Button } from "@/components/primitive/button";
import { cn } from "@/lib/utils";

export function GoogleButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="secondary" className={cn(className)} {...props}>
      <SimpleIcon icon={siGoogle} className="size-4" />
      Continue with Google
    </Button>
  );
}
