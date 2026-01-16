import { Image } from "lucide-react";
import type { ModuleConfig } from "@/lib/modules/types";

export const logoReplaceModule: ModuleConfig = {
  id: "logo-replace",
  name: "Logo替换",
  description: "替换服饰产品图片中的Logo",
  owner: "product-team",
  enabled: true,
  menu: {
    id: "menu-logo-replace",
    label: "Logo替换",
    icon: Image,
    path: "/logo-replace",
    order: 5,
  },
};
