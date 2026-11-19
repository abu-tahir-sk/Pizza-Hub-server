import "dotenv/config";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { hashPassword } from "better-auth/crypto";
import { connectDB } from "../lib/db.js";
import { MenuItem } from "../models/menuItem.model.js";

interface VendorSeed {
  name: string;
  email: string;
  businessName: string;
  plan: "premium" | "free";
  location: string;
}

const VENDORS: VendorSeed[] = [
  {
    name: "Marco Rossi",
    email: "napoli@pizzahub.com",
    businessName: "Bella Napoli Wood-Fired",
    plan: "premium",
    location: "Gulshan 2, Dhaka",
  },
  {
    name: "Luigi Romano",
    email: "artisan@pizzahub.com",
    businessName: "Artisan Crust Pizzeria",
    plan: "premium",
    location: "Banani 11, Dhaka",
  },
  {
    name: "Antonio Moretti",
    email: "brooklyn@pizzahub.com",
    businessName: "Brooklyn Slice & Oven",
    plan: "premium",
    location: "Dhanmondi 27, Dhaka",
  },
  {
    name: "Sofia Bellini",
    email: "roma@pizzahub.com",
    businessName: "Roma Brick Oven & Gelato",
    plan: "premium",
    location: "Uttara Sector 3, Dhaka",
  },
];

const PIZZAS_DATA = [
  // ── 1. Classic Pizzas (6) ──────────────────────────────────────────────────────────
  {
    itemName: "Margherita D.O.C.",
    category: "Classic Pizzas",
    description: "San Marzano D.O.P. tomatoes, fresh Fior di latte mozzarella, fresh basil leaves, sea salt, and extra virgin olive oil on 48h cold fermented dough.",
    price: 14.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Pepperoni Passion Supreme",
    category: "Classic Pizzas",
    description: "Double layers of crisp, cupping beef pepperoni, shredded whole milk mozzarella, rich marinara sauce, and a sprinkle of dried Italian oregano.",
    price: 17.50,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Quattro Formaggi (Four Cheeses)",
    category: "Classic Pizzas",
    description: "A decadent white pizza loaded with mozzarella, creamy Gorgonzola, aged fontina, and sharp Parmigiano-Reggiano drizzled with blossom honey.",
    price: 18.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Marinara Antica",
    category: "Classic Pizzas",
    description: "Traditional cheese-free Neapolitan classic: sweet crushed plum tomatoes, paper-thin sliced fresh garlic, wild mountain oregano, and cold-pressed olive oil.",
    price: 12.50,
    location: "Uttara Sector 3, Dhaka",
    vendorIdx: 3,
    images: [
      "https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Capricciosa Rustica",
    category: "Classic Pizzas",
    description: "Italian plum tomato sauce, mozzarella, savory smoked turkey ham, earthy button mushrooms, tender artichoke hearts, and black Gaeta olives.",
    price: 18.25,
    location: "Dhanmondi 27, Dhaka",
    vendorIdx: 2,
    images: [
      "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Prosciutto & Arugula Bianca",
    category: "Classic Pizzas",
    description: "Crisp white crust with mozzarella, draped post-bake with aged prosciutto, baby arugula leaves, shaved Parmigiano, and a light balsamic glaze reduction.",
    price: 19.50,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    ],
  },

  // ── 2. Vegetarian Pizzas (6) ───────────────────────────────────────────────────────
  {
    itemName: "Truffle Wild Mushroom",
    category: "Vegetarian Pizzas",
    description: "Slow-fermented dough, garlic-infused ricotta base, roasted cremini and shiitake mushrooms, fresh thyme, and white truffle glaze.",
    price: 19.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Mediterranean Garden Delight",
    category: "Vegetarian Pizzas",
    description: "Roasted bell peppers, sun-dried tomatoes, Kalamata olives, marinated artichokes, red onions, crumbled Greek feta, and fresh oregano on tomato base.",
    price: 16.50,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1576458088443-04a19bb13da6?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Spinach & Ricotta Bianca",
    category: "Vegetarian Pizzas",
    description: "Garlic cream sauce, baby spinach sautéed in extra virgin olive oil, dollops of whole milk ricotta cheese, mozzarella, and toasted pine nuts.",
    price: 16.99,
    location: "Dhanmondi 27, Dhaka",
    vendorIdx: 2,
    images: [
      "https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Spicy Jalapeño & Sweet Corn",
    category: "Vegetarian Pizzas",
    description: "Fiery sliced green jalapeños, sweet golden charred corn, diced red onions, mozzarella, spicy arrabbiata sauce, and a cilantro crema drizzle.",
    price: 15.75,
    location: "Uttara Sector 3, Dhaka",
    vendorIdx: 3,
    images: [
      "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Pesto Genovese Primavera",
    category: "Vegetarian Pizzas",
    description: "House-made sweet basil pine nut pesto, cherry heirloom tomatoes, mozzarella pearls, toasted pine nuts, and a light splash of cold-pressed olive oil.",
    price: 17.25,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1528137871618-79d2761e3fd5?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Four Seasons Veggie Feast",
    category: "Vegetarian Pizzas",
    description: "Divided in four quadrants: grilled zucchini, button mushrooms, sweet cherry tomatoes, and seasoned artichoke hearts over artisan mozzarella.",
    price: 16.99,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    ],
  },

  // ── 3. Meat Lovers (6) ─────────────────────────────────────────────────────────────
  {
    itemName: "The Carnivore Meat Monster",
    category: "Meat Lovers",
    description: "Loaded to the rim with beef pepperoni, crumbled spicy Italian sausage, smoked beef bacon, honey ham, and melted Wisconsin mozzarella.",
    price: 21.99,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Smoked Texas BBQ Chicken",
    category: "Meat Lovers",
    description: "Tender hickory-smoked chicken breast, sweet smoky BBQ sauce glaze, red onion slivers, sharp cheddar cheese, fresh cilantro, and mozzarella.",
    price: 18.50,
    location: "Dhanmondi 27, Dhaka",
    vendorIdx: 2,
    images: [
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Spicy Beef Sausage & Nduja",
    category: "Meat Lovers",
    description: "Crumbled spicy beef sausage, fiery calabrian chili paste, sweet caramelised onions, crushed san marzano tomatoes, and mozzarella.",
    price: 19.50,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Buffalo Ranch Chicken Crust",
    category: "Meat Lovers",
    description: "Crispy grilled chicken tossed in zesty Frank's RedHot buffalo sauce, cool garlic buttermilk ranch swirl, scallions, and mozzarella blend.",
    price: 18.99,
    location: "Uttara Sector 3, Dhaka",
    vendorIdx: 3,
    images: [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Philly Steak & Caramelized Onion",
    category: "Meat Lovers",
    description: "Tender seared beef steak slices, roasted bell peppers, slow-cooked caramelised sweet onions, provolone cheese, and garlic butter brushed crust.",
    price: 22.50,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Crispy Bacon & Egg Florentine",
    category: "Meat Lovers",
    description: "Crispy applewood smoked beef bacon, fresh baby spinach, organic free-range egg baked sunny-side into the centre, and melted fontina.",
    price: 19.00,
    location: "Dhanmondi 27, Dhaka",
    vendorIdx: 2,
    images: [
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80",
    ],
  },

  // ── 4. Specialty / Gourmet Pizzas (5) ─────────────────────────────────────────────
  {
    itemName: "Burrata & Hot Honey Drizzle",
    category: "Specialty / Gourmet Pizzas",
    description: "San Marzano tomatoes, whole creamy burrata cheese ball torn across the crust after bake, hot habanero-infused honey, and toasted pistachios.",
    price: 23.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Black Truffle & Gorgonzola Bianca",
    category: "Specialty / Gourmet Pizzas",
    description: "Artisan white crust, aged Italian Gorgonzola Dolce, sliced Bartlett pears, black summer truffle carpaccio, and rosemary-infused honey drizzle.",
    price: 24.50,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Smoked Salmon & Capers Bianca",
    category: "Specialty / Gourmet Pizzas",
    description: "Cream cheese and dill spread, cold-smoked Norwegian salmon slices, brined capers, pickled red shallots, and baby micro-greens.",
    price: 25.00,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Rosemary Roasted Potato & Sausage",
    category: "Specialty / Gourmet Pizzas",
    description: "Thinly mandolined Yukon gold potatoes, smoked scamorza cheese, fennel pork sausage, fresh rosemary leaves, and coarse Malden sea salt.",
    price: 19.99,
    location: "Dhanmondi 27, Dhaka",
    vendorIdx: 2,
    images: [
      "https://images.unsplash.com/photo-1576458088443-04a19bb13da6?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Artisan Fig, Goat Cheese & Walnut",
    category: "Specialty / Gourmet Pizzas",
    description: "Caramelised black mission figs, creamy French chèvre goat cheese, toasted California walnuts, baby arugula, and 12-year aged Modena balsamic glaze.",
    price: 22.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    ],
  },

  // ── 5. Sides & Appetizers (4) ─────────────────────────────────────────────────────
  {
    itemName: "Wood-Fired Garlic Knots (6 pcs)",
    category: "Sides & Appetizers",
    description: "Hand-tied dough knots baked golden, drenched in roasted garlic herb butter, grated Parmigiano-Reggiano, with warm marinara dipping sauce.",
    price: 6.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Crispy Buffalo Wings (8 pcs)",
    category: "Sides & Appetizers",
    description: "Jumbo chicken wings oven-roasted then flash crisped, tossed in cayenne pepper butter sauce, served with celery sticks and house blue cheese.",
    price: 9.99,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Truffle Parmesan Hand-Cut Fries",
    category: "Sides & Appetizers",
    description: "Crispy golden russet potatoes tossed with black truffle oil, fresh Italian parsley, coarse sea salt, and aged finely grated Parmesan cheese.",
    price: 7.50,
    location: "Dhanmondi 27, Dhaka",
    vendorIdx: 2,
    images: [
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Golden Mozzarella Sticks (6 pcs)",
    category: "Sides & Appetizers",
    description: "Breaded in seasoned Italian panko crumbs and herbs, melted stretchy whole milk mozzarella cheese inside, served with hot spicy marinara.",
    price: 7.99,
    location: "Uttara Sector 3, Dhaka",
    vendorIdx: 3,
    images: [
      "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?auto=format&fit=crop&w=800&q=80",
    ],
  },

  // ── 6. Beverages & Desserts (3) ───────────────────────────────────────────────────
  {
    itemName: "Authentic Italian Tiramisu Classico",
    category: "Beverages & Desserts",
    description: "Layers of espresso-soaked Savoiardi ladyfingers, rich mascarpone sabayon cream, and dusted with bittersweet Dutch cocoa powder.",
    price: 7.99,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Warm Nutella & Marshmallow Calzone",
    category: "Beverages & Desserts",
    description: "Wood-fired folded pizza pocket stuffed with molten Nutella hazelnut spread, mini marshmallows, dusted with powdered sugar and strawberry sauce.",
    price: 9.50,
    location: "Banani 11, Dhaka",
    vendorIdx: 1,
    images: [
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
    ],
  },
  {
    itemName: "Italian San Pellegrino Blood Orange (330ml)",
    category: "Beverages & Desserts",
    description: "Sparkling natural mineral beverage with real Mediterranean blood orange juice and subtle citrus sweetness.",
    price: 3.50,
    location: "Gulshan 2, Dhaka",
    vendorIdx: 0,
    images: [
      "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80",
    ],
  },
];

async function seedPizzas() {
  await connectDB();
  const db = mongoose.connection.db!;
  const now = new Date();
  const vendorIds: ObjectId[] = [];

  console.log("Creating/updating vendor accounts…");
  for (const v of VENDORS) {
    const existing = await db.collection("user").findOne({ email: v.email });
    let vendorId: ObjectId;

    if (existing) {
      vendorId = existing._id as ObjectId;
      await db.collection("user").updateOne(
        { _id: vendorId },
        {
          $set: {
            name: v.name,
            businessName: v.businessName,
            role: "vendor",
            subscriptionPlan: v.plan,
            subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isBlocked: false,
            emailVerified: true,
            updatedAt: now,
          },
        }
      );
    } else {
      vendorId = new ObjectId();
      await db.collection("user").insertOne({
        _id: vendorId,
        name: v.name,
        email: v.email,
        emailVerified: true,
        image: "https://images.unsplash.com/photo-1583394293214-28ded15ee548?auto=format&fit=crop&w=200&q=80",
        role: "vendor",
        isBlocked: false,
        businessName: v.businessName,
        subscriptionPlan: v.plan,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      });

      // Default password for seeded vendors: Napoli123
      const passwordHash = await hashPassword("Napoli123");
      await db.collection("account").insertOne({
        userId: vendorId,
        providerId: "credential",
        accountId: vendorId.toHexString(),
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
    }

    vendorIds.push(vendorId);
    console.log(`✓ Vendor ready: ${v.businessName} (${v.email})`);
  }

  console.log(`\nSeeding ${PIZZAS_DATA.length} artisan pizzas & menu items…`);
  let createdCount = 0;
  let updatedCount = 0;

  for (const p of PIZZAS_DATA) {
    const vendorId = vendorIds[p.vendorIdx] ?? vendorIds[0];
    const res = await MenuItem.findOneAndUpdate(
      { itemName: p.itemName },
      {
        $set: {
          vendorId,
          itemName: p.itemName,
          category: p.category,
          description: p.description,
          price: p.price,
          location: p.location,
          images: p.images,
          status: "approved",
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, new: true }
    );

    if (res.createdAt.getTime() === now.getTime()) {
      createdCount++;
    } else {
      updatedCount++;
    }
  }

  const total = await MenuItem.countDocuments();
  console.log(`\n🎉 Done! Seeded ${PIZZAS_DATA.length} items (${createdCount} created, ${updatedCount} updated). Total in DB: ${total}`);
  await mongoose.disconnect();
}

seedPizzas().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
