// Built-in starter foods. Values per 100 g from USDA FoodData Central (SR Legacy / Foundation).
import type { FoodDef } from './foodTypes';

export const LOCAL_FOODS: FoodDef[] = [
 {
  "id": "local:eggs-whole",
  "fdcId": 171287,
  "name": "Eggs, whole",
  "per100": {
   "cal": 143.0,
   "p": 12.6,
   "c": 0.7,
   "f": 9.5
  },
  "portions": [
   {
    "label": "1 medium",
    "grams": 44.0
   },
   {
    "label": "1 large",
    "grams": 50.0
   },
   {
    "label": "1 cup (4.86 large eggs)",
    "grams": 243.0
   },
   {
    "label": "1 extra large",
    "grams": 56.0
   },
   {
    "label": "1 small",
    "grams": 38.0
   },
   {
    "label": "1 jumbo",
    "grams": 63.0
   }
  ]
 },
 {
  "id": "local:egg-whites",
  "fdcId": 172183,
  "name": "Egg whites",
  "per100": {
   "cal": 52.0,
   "p": 10.9,
   "c": 0.7,
   "f": 0.2
  },
  "portions": [
   {
    "label": "1 large",
    "grams": 33.0
   },
   {
    "label": "1 cup",
    "grams": 243.0
   }
  ]
 },
 {
  "id": "local:chicken-breast-cooked",
  "fdcId": 171477,
  "name": "Chicken breast, cooked",
  "per100": {
   "cal": 165.0,
   "p": 31.0,
   "c": 0.0,
   "f": 3.6
  },
  "portions": [
   {
    "label": "1 cup, chopped or diced",
    "grams": 140.0
   },
   {
    "label": "1 unit",
    "grams": 52.0
   },
   {
    "label": "0.5 breast, bone and skin removed",
    "grams": 86.0
   }
  ]
 },
 {
  "id": "local:chicken-thigh-cooked",
  "fdcId": 172388,
  "name": "Chicken thigh, cooked",
  "per100": {
   "cal": 179.0,
   "p": 24.8,
   "c": 0.0,
   "f": 8.2
  },
  "portions": [
   {
    "label": "1 thigh with skin",
    "grams": 137.0
   },
   {
    "label": "1 thigh without skin",
    "grams": 116.0
   },
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:ground-beef-90-10-cooked",
  "fdcId": 174031,
  "name": "Ground beef 90/10, cooked",
  "per100": {
   "cal": 217.0,
   "p": 26.1,
   "c": 0.0,
   "f": 11.8
  },
  "portions": [
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:ground-beef-80-20-cooked",
  "fdcId": 171797,
  "name": "Ground beef 80/20, cooked",
  "per100": {
   "cal": 270.0,
   "p": 25.8,
   "c": 0.0,
   "f": 17.8
  },
  "portions": [
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:ground-turkey-93-7-cooked",
  "fdcId": 172851,
  "name": "Ground turkey 93/7, cooked",
  "per100": {
   "cal": 213.0,
   "p": 27.1,
   "c": 0.0,
   "f": 11.6
  },
  "portions": [
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:sirloin-steak-cooked",
  "fdcId": 168635,
  "name": "Sirloin steak, cooked",
  "per100": {
   "cal": 188.0,
   "p": 30.3,
   "c": 0.0,
   "f": 6.5
  },
  "portions": [
   {
    "label": "1 steak",
    "grams": 393.0
   },
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:salmon-cooked",
  "fdcId": 175168,
  "name": "Salmon, cooked",
  "per100": {
   "cal": 206.0,
   "p": 22.1,
   "c": 0.0,
   "f": 12.3
  },
  "portions": [
   {
    "label": "0.5 fillet",
    "grams": 178.0
   },
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:tuna-canned-in-water",
  "fdcId": 334194,
  "name": "Tuna, canned in water",
  "per100": {
   "cal": 90.0,
   "p": 19.0,
   "c": 0.1,
   "f": 0.9
  },
  "portions": [
   {
    "label": "1 total can contents",
    "grams": 142.0
   },
   {
    "label": "1 drained solids",
    "grams": 107.0
   }
  ]
 },
 {
  "id": "local:tilapia-cooked",
  "fdcId": 175177,
  "name": "Tilapia, cooked",
  "per100": {
   "cal": 128.0,
   "p": 26.1,
   "c": 0.0,
   "f": 2.6
  },
  "portions": [
   {
    "label": "1 fillet",
    "grams": 87.0
   }
  ]
 },
 {
  "id": "local:shrimp-cooked",
  "fdcId": 175180,
  "name": "Shrimp, cooked",
  "per100": {
   "cal": 99.0,
   "p": 24.0,
   "c": 0.2,
   "f": 0.3
  },
  "portions": [
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:pork-tenderloin-cooked",
  "fdcId": 168250,
  "name": "Pork tenderloin, cooked",
  "per100": {
   "cal": 143.0,
   "p": 26.2,
   "c": 0.0,
   "f": 3.5
  },
  "portions": [
   {
    "label": "1 piece, cooked, excluding refuse",
    "grams": 333.0
   },
   {
    "label": "1 roast",
    "grams": 402.0
   },
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:bacon-cooked",
  "fdcId": 168322,
  "name": "Bacon, cooked",
  "per100": {
   "cal": 468.0,
   "p": 33.9,
   "c": 1.7,
   "f": 35.1
  },
  "portions": [
   {
    "label": "1 slice",
    "grams": 11.5
   },
   {
    "label": "3 oz",
    "grams": 85.0
   }
  ]
 },
 {
  "id": "local:deli-turkey",
  "fdcId": 172941,
  "name": "Deli turkey",
  "per100": {
   "cal": 106.0,
   "p": 14.8,
   "c": 2.2,
   "f": 3.8
  },
  "portions": [
   {
    "label": "1 slice",
    "grams": 16.0
   }
  ]
 },
 {
  "id": "local:greek-yogurt-plain-nonfat",
  "fdcId": 330137,
  "name": "Greek yogurt, plain nonfat",
  "per100": {
   "cal": 61.0,
   "p": 10.3,
   "c": 3.6,
   "f": 0.4
  },
  "portions": []
 },
 {
  "id": "local:cottage-cheese-low-fat",
  "fdcId": 328841,
  "name": "Cottage cheese, low fat",
  "per100": {
   "cal": 84.0,
   "p": 11.0,
   "c": 4.3,
   "f": 2.3
  },
  "portions": []
 },
 {
  "id": "local:milk-2",
  "fdcId": 171267,
  "name": "Milk, 2%",
  "per100": {
   "cal": 50.0,
   "p": 3.3,
   "c": 4.8,
   "f": 2.0
  },
  "portions": [
   {
    "label": "1 quart",
    "grams": 976.0
   },
   {
    "label": "1 cup",
    "grams": 244.0
   },
   {
    "label": "1 fl oz",
    "grams": 30.5
   }
  ]
 },
 {
  "id": "local:milk-whole",
  "fdcId": 746782,
  "name": "Milk, whole",
  "per100": {
   "cal": 60.0,
   "p": 3.3,
   "c": 4.6,
   "f": 3.2
  },
  "portions": []
 },
 {
  "id": "local:milk-skim",
  "fdcId": 171269,
  "name": "Milk, skim",
  "per100": {
   "cal": 34.0,
   "p": 3.4,
   "c": 5.0,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 245.0
   },
   {
    "label": "1 quart",
    "grams": 980.0
   },
   {
    "label": "1 fl oz",
    "grams": 30.6
   }
  ]
 },
 {
  "id": "local:cheddar-cheese",
  "fdcId": 328637,
  "name": "Cheddar cheese",
  "per100": {
   "cal": 408.0,
   "p": 23.3,
   "c": 2.4,
   "f": 34.0
  },
  "portions": [
   {
    "label": "shredded",
    "grams": 105.0
   }
  ]
 },
 {
  "id": "local:mozzarella-part-skim",
  "fdcId": 170847,
  "name": "Mozzarella, part skim",
  "per100": {
   "cal": 254.0,
   "p": 24.3,
   "c": 2.8,
   "f": 15.9
  },
  "portions": [
   {
    "label": "1 oz",
    "grams": 28.4
   }
  ]
 },
 {
  "id": "local:whey-protein-powder",
  "fdcId": 173177,
  "name": "Whey protein powder",
  "per100": {
   "cal": 359.0,
   "p": 58.1,
   "c": 29.1,
   "f": 1.2
  },
  "portions": [
   {
    "label": "3 scoop",
    "grams": 86.0
   }
  ]
 },
 {
  "id": "local:butter",
  "fdcId": 173410,
  "name": "Butter",
  "per100": {
   "cal": 717.0,
   "p": 0.8,
   "c": 0.1,
   "f": 81.1
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 14.2
   },
   {
    "label": "1 pat (1\" sq, 1/3\" high)",
    "grams": 5.0
   },
   {
    "label": "1 stick",
    "grams": 113.0
   },
   {
    "label": "1 cup",
    "grams": 227.0
   }
  ]
 },
 {
  "id": "local:tofu-firm",
  "fdcId": 172475,
  "name": "Tofu, firm",
  "per100": {
   "cal": 144.0,
   "p": 17.3,
   "c": 2.8,
   "f": 8.7
  },
  "portions": [
   {
    "label": "0.5 cup",
    "grams": 126.0
   },
   {
    "label": "0.25 block",
    "grams": 81.0
   }
  ]
 },
 {
  "id": "local:white-rice-cooked",
  "fdcId": 168878,
  "name": "White rice, cooked",
  "per100": {
   "cal": 130.0,
   "p": 2.7,
   "c": 28.2,
   "f": 0.3
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 158.0
   }
  ]
 },
 {
  "id": "local:brown-rice-cooked",
  "fdcId": 169704,
  "name": "Brown rice, cooked",
  "per100": {
   "cal": 123.0,
   "p": 2.7,
   "c": 25.6,
   "f": 1.0
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 202.0
   }
  ]
 },
 {
  "id": "local:oats-dry",
  "fdcId": 173904,
  "name": "Oats, dry",
  "per100": {
   "cal": 379.0,
   "p": 13.2,
   "c": 67.7,
   "f": 6.5
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 81.0
   },
   {
    "label": "0.33 cup",
    "grams": 27.0
   }
  ]
 },
 {
  "id": "local:oatmeal-cooked",
  "fdcId": 173905,
  "name": "Oatmeal, cooked",
  "per100": {
   "cal": 71.0,
   "p": 2.5,
   "c": 12.0,
   "f": 1.5
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 14.6
   },
   {
    "label": "1 cup",
    "grams": 234.0
   },
   {
    "label": "0.75 cup",
    "grams": 175.0
   }
  ]
 },
 {
  "id": "local:pasta-cooked",
  "fdcId": 169737,
  "name": "Pasta, cooked",
  "per100": {
   "cal": 158.0,
   "p": 5.8,
   "c": 30.9,
   "f": 0.9
  },
  "portions": [
   {
    "label": "1 cup lasagne",
    "grams": 116.0
   },
   {
    "label": "1 cup shells",
    "grams": 105.0
   },
   {
    "label": "1 cup farfalle",
    "grams": 107.0
   },
   {
    "label": "1 cup spaghetti not packed",
    "grams": 124.0
   },
   {
    "label": "1 cup elbows packed",
    "grams": 132.0
   },
   {
    "label": "1 cup elbows not packed",
    "grams": 120.0
   }
  ]
 },
 {
  "id": "local:whole-wheat-bread",
  "fdcId": 172688,
  "name": "Whole wheat bread",
  "per100": {
   "cal": 252.0,
   "p": 12.4,
   "c": 42.7,
   "f": 3.5
  },
  "portions": [
   {
    "label": "1 slice",
    "grams": 32.0
   },
   {
    "label": "1 oz",
    "grams": 28.4
   }
  ]
 },
 {
  "id": "local:white-bread",
  "fdcId": 174924,
  "name": "White bread",
  "per100": {
   "cal": 266.0,
   "p": 8.8,
   "c": 49.4,
   "f": 3.3
  },
  "portions": [
   {
    "label": "1 slice",
    "grams": 29.0
   },
   {
    "label": "1 slice crust not eaten",
    "grams": 12.0
   },
   {
    "label": "1 slice, thin",
    "grams": 20.0
   },
   {
    "label": "1 slice, very thin",
    "grams": 15.0
   },
   {
    "label": "1 cup, cubes",
    "grams": 35.0
   },
   {
    "label": "1 cup, crumbs",
    "grams": 45.0
   }
  ]
 },
 {
  "id": "local:bagel-plain",
  "fdcId": 174899,
  "name": "Bagel, plain",
  "per100": {
   "cal": 264.0,
   "p": 10.6,
   "c": 52.4,
   "f": 1.3
  },
  "portions": [
   {
    "label": "1 medium bagel (3-1/2\" to 4\" dia)",
    "grams": 105.0
   },
   {
    "label": "1 large bagel (4-1/2\")",
    "grams": 131.0
   },
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 mini bagel (2-1/2\" dia)",
    "grams": 26.0
   },
   {
    "label": "1 small bagel (3\" dia)",
    "grams": 69.0
   },
   {
    "label": "1 bagel",
    "grams": 99.0
   }
  ]
 },
 {
  "id": "local:flour-tortilla",
  "fdcId": 175037,
  "name": "Flour tortilla",
  "per100": {
   "cal": 306.0,
   "p": 8.2,
   "c": 49.4,
   "f": 8.0
  },
  "portions": [
   {
    "label": "1 tortilla (approx 12\" dia)",
    "grams": 117.0
   },
   {
    "label": "1 package",
    "grams": 407.0
   },
   {
    "label": "1 tortilla",
    "grams": 48.0
   },
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 tortilla medium (approx 6\" dia)",
    "grams": 30.0
   },
   {
    "label": "1 tortilla (approx 7-8\" dia)",
    "grams": 49.0
   }
  ]
 },
 {
  "id": "local:corn-tortilla",
  "fdcId": 175036,
  "name": "Corn tortilla",
  "per100": {
   "cal": 218.0,
   "p": 5.7,
   "c": 44.6,
   "f": 2.9
  },
  "portions": [
   {
    "label": "1 enchilada",
    "grams": 19.0
   },
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 tortilla",
    "grams": 24.0
   }
  ]
 },
 {
  "id": "local:potato-baked",
  "fdcId": 170093,
  "name": "Potato, baked",
  "per100": {
   "cal": 93.0,
   "p": 2.5,
   "c": 21.1,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 NLEA serving",
    "grams": 148.0
   },
   {
    "label": "1 potato large",
    "grams": 299.0
   },
   {
    "label": "1 potato medium",
    "grams": 173.0
   },
   {
    "label": "1 potato small",
    "grams": 138.0
   }
  ]
 },
 {
  "id": "local:sweet-potato-baked",
  "fdcId": 168483,
  "name": "Sweet potato, baked",
  "per100": {
   "cal": 90.0,
   "p": 2.0,
   "c": 20.7,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 large",
    "grams": 180.0
   },
   {
    "label": "1 medium (2\" dia, 5\" long, raw)",
    "grams": 114.0
   },
   {
    "label": "1 small",
    "grams": 60.0
   },
   {
    "label": "1 cup",
    "grams": 200.0
   }
  ]
 },
 {
  "id": "local:quinoa-cooked",
  "fdcId": 168917,
  "name": "Quinoa, cooked",
  "per100": {
   "cal": 120.0,
   "p": 4.4,
   "c": 21.3,
   "f": 1.9
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 185.0
   }
  ]
 },
 {
  "id": "local:black-beans-cooked",
  "fdcId": 173735,
  "name": "Black beans, cooked",
  "per100": {
   "cal": 132.0,
   "p": 8.9,
   "c": 23.7,
   "f": 0.5
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 172.0
   }
  ]
 },
 {
  "id": "local:chickpeas-cooked",
  "fdcId": 173757,
  "name": "Chickpeas, cooked",
  "per100": {
   "cal": 164.0,
   "p": 8.9,
   "c": 27.4,
   "f": 2.6
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 164.0
   }
  ]
 },
 {
  "id": "local:lentils-cooked",
  "fdcId": 172421,
  "name": "Lentils, cooked",
  "per100": {
   "cal": 116.0,
   "p": 9.0,
   "c": 20.1,
   "f": 0.4
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 12.3
   },
   {
    "label": "1 cup",
    "grams": 198.0
   }
  ]
 },
 {
  "id": "local:rice-cakes",
  "fdcId": 170250,
  "name": "Rice cakes",
  "per100": {
   "cal": 387.0,
   "p": 8.2,
   "c": 81.5,
   "f": 2.8
  },
  "portions": [
   {
    "label": "1 cake",
    "grams": 9.0
   },
   {
    "label": "2 cakes",
    "grams": 18.0
   }
  ]
 },
 {
  "id": "local:granola",
  "fdcId": 171646,
  "name": "Granola",
  "per100": {
   "cal": 489.0,
   "p": 13.7,
   "c": 53.9,
   "f": 24.3
  },
  "portions": [
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 cup",
    "grams": 122.0
   }
  ]
 },
 {
  "id": "local:cheerios",
  "fdcId": 173884,
  "name": "Cheerios",
  "per100": {
   "cal": 372.0,
   "p": 12.4,
   "c": 73.2,
   "f": 6.6
  },
  "portions": [
   {
    "label": "1 cup (1 NLEA serving)",
    "grams": 28.0
   }
  ]
 },
 {
  "id": "local:banana",
  "fdcId": 173944,
  "name": "Banana",
  "per100": {
   "cal": 89.0,
   "p": 1.1,
   "c": 22.8,
   "f": 0.3
  },
  "portions": [
   {
    "label": "1 large (8\" to 8-7/8\" long)",
    "grams": 136.0
   },
   {
    "label": "1 NLEA serving",
    "grams": 126.0
   },
   {
    "label": "1 extra large (9\" or longer)",
    "grams": 152.0
   },
   {
    "label": "1 cup, sliced",
    "grams": 150.0
   },
   {
    "label": "1 small (6\" to 6-7/8\" long)",
    "grams": 101.0
   },
   {
    "label": "1 extra small (less than 6\" long)",
    "grams": 81.0
   }
  ]
 },
 {
  "id": "local:apple",
  "fdcId": 171688,
  "name": "Apple",
  "per100": {
   "cal": 52.0,
   "p": 0.3,
   "c": 13.8,
   "f": 0.2
  },
  "portions": [
   {
    "label": "1 medium (3\" dia)",
    "grams": 182.0
   },
   {
    "label": "1 cup slices",
    "grams": 109.0
   },
   {
    "label": "1 small (2-3/4\" dia)",
    "grams": 149.0
   },
   {
    "label": "1 NLEA serving",
    "grams": 242.0
   },
   {
    "label": "1 cup, quartered or chopped",
    "grams": 125.0
   },
   {
    "label": "1 extra small (2-1/2\" dia)",
    "grams": 101.0
   }
  ]
 },
 {
  "id": "local:orange",
  "fdcId": 169097,
  "name": "Orange",
  "per100": {
   "cal": 47.0,
   "p": 0.9,
   "c": 11.8,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 large (3-1/16\" dia)",
    "grams": 184.0
   },
   {
    "label": "1 fruit (2-5/8\" dia)",
    "grams": 131.0
   },
   {
    "label": "1 small (2-3/8\" dia)",
    "grams": 96.0
   },
   {
    "label": "1 cup, sections",
    "grams": 180.0
   }
  ]
 },
 {
  "id": "local:blueberries",
  "fdcId": 2346411,
  "name": "Blueberries",
  "per100": {
   "cal": 63.9,
   "p": 0.7,
   "c": 14.6,
   "f": 0.3
  },
  "portions": []
 },
 {
  "id": "local:strawberries",
  "fdcId": 167762,
  "name": "Strawberries",
  "per100": {
   "cal": 32.0,
   "p": 0.7,
   "c": 7.7,
   "f": 0.3
  },
  "portions": [
   {
    "label": "1 large (1-3/8\" dia)",
    "grams": 18.0
   },
   {
    "label": "1 medium (1-1/4\" dia)",
    "grams": 12.0
   },
   {
    "label": "1 cup, pureed",
    "grams": 232.0
   },
   {
    "label": "1 cup, sliced",
    "grams": 166.0
   },
   {
    "label": "1 pint as purchased, yields",
    "grams": 357.0
   },
   {
    "label": "1 cup, halves",
    "grams": 152.0
   }
  ]
 },
 {
  "id": "local:grapes",
  "fdcId": 174683,
  "name": "Grapes",
  "per100": {
   "cal": 69.0,
   "p": 0.7,
   "c": 18.1,
   "f": 0.2
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 151.0
   },
   {
    "label": "10 grapes",
    "grams": 49.0
   },
   {
    "label": "1 NLEA serving",
    "grams": 126.0
   }
  ]
 },
 {
  "id": "local:pineapple",
  "fdcId": 169124,
  "name": "Pineapple",
  "per100": {
   "cal": 50.0,
   "p": 0.5,
   "c": 13.1,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 slice, thin (3-1/2\" dia x 1/2\" thick)",
    "grams": 56.0
   },
   {
    "label": "1 slice (4-2/3\" dia x 3/4\" thick)",
    "grams": 166.0
   },
   {
    "label": "1 fruit",
    "grams": 905.0
   },
   {
    "label": "1 slice (3-1/2\" dia x 3/4\" thick)",
    "grams": 84.0
   },
   {
    "label": "1 cup, chunks",
    "grams": 165.0
   }
  ]
 },
 {
  "id": "local:mango",
  "fdcId": 169910,
  "name": "Mango",
  "per100": {
   "cal": 60.0,
   "p": 0.8,
   "c": 15.0,
   "f": 0.4
  },
  "portions": [
   {
    "label": "1 fruit without refuse",
    "grams": 336.0
   },
   {
    "label": "1 cup pieces",
    "grams": 165.0
   }
  ]
 },
 {
  "id": "local:avocado",
  "fdcId": 171705,
  "name": "Avocado",
  "per100": {
   "cal": 160.0,
   "p": 2.0,
   "c": 8.5,
   "f": 14.7
  },
  "portions": [
   {
    "label": "1 cup, pureed",
    "grams": 230.0
   },
   {
    "label": "1 cup, cubes",
    "grams": 150.0
   },
   {
    "label": "1 cup, sliced",
    "grams": 146.0
   },
   {
    "label": "1 NLEA Serving",
    "grams": 50.0
   },
   {
    "label": "1 avocado, NS as to Florida or California",
    "grams": 201.0
   }
  ]
 },
 {
  "id": "local:raisins",
  "fdcId": 168165,
  "name": "Raisins",
  "per100": {
   "cal": 299.0,
   "p": 3.3,
   "c": 79.3,
   "f": 0.2
  },
  "portions": [
   {
    "label": "1 oz (60 raisins)",
    "grams": 28.4
   },
   {
    "label": "1 miniature box (.5 oz)",
    "grams": 14.0
   },
   {
    "label": "1 small box (1.5 oz)",
    "grams": 43.0
   },
   {
    "label": "50 raisins",
    "grams": 26.0
   },
   {
    "label": "1 cup (not packed)",
    "grams": 145.0
   },
   {
    "label": "1 cup, packed",
    "grams": 165.0
   }
  ]
 },
 {
  "id": "local:broccoli-cooked",
  "fdcId": 169967,
  "name": "Broccoli, cooked",
  "per100": {
   "cal": 35.0,
   "p": 2.4,
   "c": 7.2,
   "f": 0.4
  },
  "portions": [
   {
    "label": "1 stalk, large (11\"-12\" long)",
    "grams": 280.0
   },
   {
    "label": "1 spear (about 5\" long)",
    "grams": 37.0
   },
   {
    "label": "0.5 cup, chopped",
    "grams": 78.0
   },
   {
    "label": "1 stalk, medium (7-1/2\" - 8\" long)",
    "grams": 180.0
   },
   {
    "label": "1 stalk, small (5\" long)",
    "grams": 140.0
   }
  ]
 },
 {
  "id": "local:spinach-raw",
  "fdcId": 168462,
  "name": "Spinach, raw",
  "per100": {
   "cal": 23.0,
   "p": 2.9,
   "c": 3.6,
   "f": 0.4
  },
  "portions": [
   {
    "label": "1 bunch",
    "grams": 340.0
   },
   {
    "label": "1 leaf",
    "grams": 10.0
   },
   {
    "label": "1 cup",
    "grams": 30.0
   },
   {
    "label": "1 package (10 oz)",
    "grams": 284.0
   }
  ]
 },
 {
  "id": "local:mixed-salad-greens",
  "fdcId": 169249,
  "name": "Mixed salad greens",
  "per100": {
   "cal": 15.0,
   "p": 1.4,
   "c": 2.9,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 head",
    "grams": 360.0
   },
   {
    "label": "1 leaf inner",
    "grams": 4.8
   },
   {
    "label": "1 leaf outer",
    "grams": 24.0
   },
   {
    "label": "1 cup shredded",
    "grams": 36.0
   }
  ]
 },
 {
  "id": "local:carrots",
  "fdcId": 170393,
  "name": "Carrots",
  "per100": {
   "cal": 41.0,
   "p": 0.9,
   "c": 9.6,
   "f": 0.2
  },
  "portions": [
   {
    "label": "1 slice",
    "grams": 3.0
   },
   {
    "label": "1 medium",
    "grams": 61.0
   },
   {
    "label": "1 large (7-1/4\" to 8-/1/2\" long)",
    "grams": 72.0
   },
   {
    "label": "1 cup grated",
    "grams": 110.0
   },
   {
    "label": "1 strip large (3\" long)",
    "grams": 7.0
   },
   {
    "label": "1 small (5-1/2\" long)",
    "grams": 50.0
   }
  ]
 },
 {
  "id": "local:green-beans-cooked",
  "fdcId": 169141,
  "name": "Green beans, cooked",
  "per100": {
   "cal": 35.0,
   "p": 1.9,
   "c": 7.9,
   "f": 0.3
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 125.0
   }
  ]
 },
 {
  "id": "local:bell-pepper",
  "fdcId": 170108,
  "name": "Bell pepper",
  "per100": {
   "cal": 26.0,
   "p": 1.0,
   "c": 6.0,
   "f": 0.3
  },
  "portions": [
   {
    "label": "1 large (2-1/4 per pound, approx 3-3/4\" long, 3\" dia.)",
    "grams": 164.0
   },
   {
    "label": "1 medium (approx 2-3/4\" long, 2-1/2 dia.)",
    "grams": 119.0
   },
   {
    "label": "1 tablespoon",
    "grams": 9.3
   },
   {
    "label": "1 cup, sliced",
    "grams": 92.0
   },
   {
    "label": "1 cup, chopped",
    "grams": 149.0
   },
   {
    "label": "1 ring (3\" dia., 1/4\" thick)",
    "grams": 10.0
   }
  ]
 },
 {
  "id": "local:onion",
  "fdcId": 170000,
  "name": "Onion",
  "per100": {
   "cal": 40.0,
   "p": 1.1,
   "c": 9.3,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 slice, medium (1/8\" thick)",
    "grams": 14.0
   },
   {
    "label": "1 medium (2-1/2\" dia)",
    "grams": 110.0
   },
   {
    "label": "1 large",
    "grams": 150.0
   },
   {
    "label": "1 tbsp chopped",
    "grams": 10.0
   },
   {
    "label": "1 cup, chopped",
    "grams": 160.0
   },
   {
    "label": "10 rings",
    "grams": 60.0
   }
  ]
 },
 {
  "id": "local:tomato",
  "fdcId": 170457,
  "name": "Tomato",
  "per100": {
   "cal": 18.0,
   "p": 0.9,
   "c": 3.9,
   "f": 0.2
  },
  "portions": [
   {
    "label": "1 medium whole (2-3/5\" dia)",
    "grams": 123.0
   },
   {
    "label": "1 slice, medium (1/4\" thick)",
    "grams": 20.0
   },
   {
    "label": "1 large whole (3\" dia)",
    "grams": 182.0
   },
   {
    "label": "1 slice, thin/small",
    "grams": 15.0
   },
   {
    "label": "1 cherry",
    "grams": 17.0
   },
   {
    "label": "1 Italian tomato",
    "grams": 62.0
   }
  ]
 },
 {
  "id": "local:cucumber",
  "fdcId": 2346406,
  "name": "Cucumber",
  "per100": {
   "cal": 15.9,
   "p": 0.6,
   "c": 3.0,
   "f": 0.2
  },
  "portions": []
 },
 {
  "id": "local:asparagus-cooked",
  "fdcId": 168390,
  "name": "Asparagus, cooked",
  "per100": {
   "cal": 22.0,
   "p": 2.4,
   "c": 4.1,
   "f": 0.2
  },
  "portions": [
   {
    "label": "4 spears (1/2\" base)",
    "grams": 60.0
   },
   {
    "label": "0.5 cup",
    "grams": 90.0
   }
  ]
 },
 {
  "id": "local:mixed-vegetables-frozen",
  "fdcId": 170472,
  "name": "Mixed vegetables, frozen",
  "per100": {
   "cal": 65.0,
   "p": 2.9,
   "c": 13.1,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 package (10 oz) yields",
    "grams": 275.0
   },
   {
    "label": "0.5 cup",
    "grams": 91.0
   }
  ]
 },
 {
  "id": "local:corn-sweet",
  "fdcId": 169999,
  "name": "Corn, sweet",
  "per100": {
   "cal": 96.0,
   "p": 3.4,
   "c": 21.0,
   "f": 1.5
  },
  "portions": [
   {
    "label": "1 ear small (5-1/2\" to 6-1/2\" long)",
    "grams": 89.0
   },
   {
    "label": "1 cup cut",
    "grams": 149.0
   },
   {
    "label": "1 baby ear",
    "grams": 8.0
   },
   {
    "label": "1 ear medium (6-3/4\" to 7-1/2\" long)",
    "grams": 103.0
   },
   {
    "label": "1 ear large (7-3/4\" to 9\" long)",
    "grams": 118.0
   }
  ]
 },
 {
  "id": "local:peanut-butter",
  "fdcId": 172470,
  "name": "Peanut butter",
  "per100": {
   "cal": 598.0,
   "p": 22.2,
   "c": 22.3,
   "f": 51.4
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 258.0
   },
   {
    "label": "2 tbsp",
    "grams": 32.0
   }
  ]
 },
 {
  "id": "local:almonds",
  "fdcId": 170567,
  "name": "Almonds",
  "per100": {
   "cal": 579.0,
   "p": 21.1,
   "c": 21.6,
   "f": 49.9
  },
  "portions": [
   {
    "label": "1 oz (23 whole kernels)",
    "grams": 28.4
   },
   {
    "label": "1 almond",
    "grams": 1.2
   },
   {
    "label": "1 cup, whole",
    "grams": 143.0
   },
   {
    "label": "1 cup, slivered",
    "grams": 108.0
   },
   {
    "label": "1 cup, ground",
    "grams": 95.0
   },
   {
    "label": "1 cup, sliced",
    "grams": 92.0
   }
  ]
 },
 {
  "id": "local:walnuts",
  "fdcId": 170187,
  "name": "Walnuts",
  "per100": {
   "cal": 654.0,
   "p": 15.2,
   "c": 13.7,
   "f": 65.2
  },
  "portions": [
   {
    "label": "1 cup, ground",
    "grams": 80.0
   },
   {
    "label": "1 cup, chopped",
    "grams": 117.0
   },
   {
    "label": "1 cup, in shell, edible yield (7 nuts)",
    "grams": 28.0
   },
   {
    "label": "1 cup pieces or chips",
    "grams": 120.0
   },
   {
    "label": "1 cup shelled (50 halves)",
    "grams": 100.0
   },
   {
    "label": "1 oz (14 halves)",
    "grams": 28.4
   }
  ]
 },
 {
  "id": "local:cashews",
  "fdcId": 170571,
  "name": "Cashews",
  "per100": {
   "cal": 574.0,
   "p": 15.3,
   "c": 32.7,
   "f": 46.4
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 8.6
   },
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 cup, halves and whole",
    "grams": 137.0
   }
  ]
 },
 {
  "id": "local:olive-oil",
  "fdcId": 171413,
  "name": "Olive oil",
  "per100": {
   "cal": 884.0,
   "p": 0.0,
   "c": 0.0,
   "f": 100.0
  },
  "portions": [
   {
    "label": "1 tablespoon",
    "grams": 13.5
   },
   {
    "label": "1 tsp",
    "grams": 4.5
   },
   {
    "label": "1 cup",
    "grams": 216.0
   }
  ]
 },
 {
  "id": "local:honey",
  "fdcId": 169640,
  "name": "Honey",
  "per100": {
   "cal": 304.0,
   "p": 0.3,
   "c": 82.4,
   "f": 0.0
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 21.0
   },
   {
    "label": "1 cup",
    "grams": 339.0
   },
   {
    "label": "1 packet (0.5 oz)",
    "grams": 14.0
   }
  ]
 },
 {
  "id": "local:maple-syrup",
  "fdcId": 169661,
  "name": "Maple syrup",
  "per100": {
   "cal": 260.0,
   "p": 0.0,
   "c": 67.0,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 20.0
   },
   {
    "label": "1 cup",
    "grams": 315.0
   },
   {
    "label": "1 serving 1/4 cup",
    "grams": 83.0
   }
  ]
 },
 {
  "id": "local:hummus",
  "fdcId": 174289,
  "name": "Hummus",
  "per100": {
   "cal": 237.0,
   "p": 7.8,
   "c": 15.0,
   "f": 17.8
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 15.0
   },
   {
    "label": "1 cup",
    "grams": 246.0
   }
  ]
 },
 {
  "id": "local:dark-chocolate",
  "fdcId": 170273,
  "name": "Dark chocolate",
  "per100": {
   "cal": 598.0,
   "p": 7.8,
   "c": 45.9,
   "f": 42.6
  },
  "portions": [
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 bar",
    "grams": 101.0
   }
  ]
 },
 {
  "id": "local:orange-juice",
  "fdcId": 169100,
  "name": "Orange juice",
  "per100": {
   "cal": 49.0,
   "p": 0.7,
   "c": 11.5,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 fl oz",
    "grams": 31.1
   },
   {
    "label": "1 cup",
    "grams": 249.0
   }
  ]
 },
 {
  "id": "local:coffee-black",
  "fdcId": 171890,
  "name": "Coffee, black",
  "per100": {
   "cal": 1.0,
   "p": 0.1,
   "c": 0.0,
   "f": 0.0
  },
  "portions": [
   {
    "label": "1 cup (8 fl oz)",
    "grams": 237.0
   },
   {
    "label": "1 fl oz",
    "grams": 29.6
   },
   {
    "label": "6 fl oz",
    "grams": 178.0
   }
  ]
 },
 {
  "id": "local:sports-drink",
  "fdcId": 173660,
  "name": "Sports drink",
  "per100": {
   "cal": 26.0,
   "p": 0.0,
   "c": 6.4,
   "f": 0.0
  },
  "portions": [
   {
    "label": "1 bottle",
    "grams": 609.0
   },
   {
    "label": "1 fl oz",
    "grams": 30.5
   },
   {
    "label": "8 fl oz",
    "grams": 244.0
   }
  ]
 },
 {
  "id": "local:pizza-cheese",
  "fdcId": 170317,
  "name": "Pizza, cheese",
  "per100": {
   "cal": 268.0,
   "p": 10.4,
   "c": 29.0,
   "f": 12.3
  },
  "portions": [
   {
    "label": "1 serving 9 servings per 24 oz package",
    "grams": 81.0
   },
   {
    "label": "1 serving 3 servings per 15.1 oz package",
    "grams": 151.0
   },
   {
    "label": "1 package 15.1 oz pizza",
    "grams": 452.0
   },
   {
    "label": "1 package 24 oz pizza",
    "grams": 727.0
   },
   {
    "label": "1 package 9.8 oz pizza",
    "grams": 293.0
   },
   {
    "label": "1 serving 2 servings per 9.8 oz package",
    "grams": 146.0
   }
  ]
 },
 {
  "id": "local:hamburger-bun",
  "fdcId": 172796,
  "name": "Hamburger bun",
  "per100": {
   "cal": 279.0,
   "p": 9.8,
   "c": 50.1,
   "f": 3.9
  },
  "portions": [
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "1 roll 1 serving",
    "grams": 44.0
   }
  ]
 },
 {
  "id": "local:ketchup",
  "fdcId": 168556,
  "name": "Ketchup",
  "per100": {
   "cal": 101.0,
   "p": 1.0,
   "c": 27.4,
   "f": 0.1
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 17.0
   },
   {
    "label": "1 packet",
    "grams": 9.0
   },
   {
    "label": "1 cup",
    "grams": 240.0
   }
  ]
 },
 {
  "id": "local:mayonnaise",
  "fdcId": 171009,
  "name": "Mayonnaise",
  "per100": {
   "cal": 680.0,
   "p": 1.0,
   "c": 0.6,
   "f": 74.8
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 13.8
   },
   {
    "label": "1 cup",
    "grams": 220.0
   },
   {
    "label": "1 packet",
    "grams": 10.0
   }
  ]
 },
 {
  "id": "local:ranch-dressing",
  "fdcId": 173592,
  "name": "Ranch dressing",
  "per100": {
   "cal": 430.0,
   "p": 1.3,
   "c": 5.9,
   "f": 44.5
  },
  "portions": [
   {
    "label": "1 serving",
    "grams": 30.0
   },
   {
    "label": "1 tablespoon",
    "grams": 15.0
   }
  ]
 },
 {
  "id": "local:salsa",
  "fdcId": 746777,
  "name": "Salsa",
  "per100": {
   "cal": 29.0,
   "p": 1.4,
   "c": 6.7,
   "f": 0.2
  },
  "portions": []
 },
 {
  "id": "local:soy-sauce",
  "fdcId": 174277,
  "name": "Soy sauce",
  "per100": {
   "cal": 53.0,
   "p": 8.1,
   "c": 4.9,
   "f": 0.6
  },
  "portions": [
   {
    "label": "1 tbsp",
    "grams": 16.0
   },
   {
    "label": "1 individual packet",
    "grams": 8.9
   },
   {
    "label": "1 tsp",
    "grams": 5.3
   },
   {
    "label": "1 cup",
    "grams": 255.0
   }
  ]
 },
 {
  "id": "local:jerky-beef",
  "fdcId": 167536,
  "name": "Jerky, beef",
  "per100": {
   "cal": 410.0,
   "p": 33.2,
   "c": 11.0,
   "f": 25.6
  },
  "portions": [
   {
    "label": "1 piece, large",
    "grams": 20.0
   },
   {
    "label": "1 oz",
    "grams": 28.4
   }
  ]
 },
 {
  "id": "local:popcorn-air-popped",
  "fdcId": 167959,
  "name": "Popcorn, air-popped",
  "per100": {
   "cal": 387.0,
   "p": 12.9,
   "c": 77.8,
   "f": 4.5
  },
  "portions": [
   {
    "label": "1 cup",
    "grams": 8.0
   },
   {
    "label": "1 oz",
    "grams": 28.4
   }
  ]
 },
 {
  "id": "local:pretzels",
  "fdcId": 167555,
  "name": "Pretzels",
  "per100": {
   "cal": 384.0,
   "p": 10.0,
   "c": 80.4,
   "f": 2.9
  },
  "portions": [
   {
    "label": "1 oz",
    "grams": 28.4
   },
   {
    "label": "10 twists",
    "grams": 60.0
   }
  ]
 },
 {
  "id": "local:ice-cream-vanilla",
  "fdcId": 167575,
  "name": "Ice cream, vanilla",
  "per100": {
   "cal": 207.0,
   "p": 3.5,
   "c": 23.6,
   "f": 11.0
  },
  "portions": [
   {
    "label": "1 serving 1/2 cup",
    "grams": 66.0
   }
  ]
 }
];
