export interface FoodPortion { label: string; grams: number }
export interface FoodDef {
  id: string;            // "local:slug" | "usda:12345" | "off:barcode"
  fdcId?: number;
  name: string;
  brand?: string;
  per100: { cal: number; p: number; c: number; f: number };
  portions: FoodPortion[];
  source?: "local" | "usda" | "off";
}
