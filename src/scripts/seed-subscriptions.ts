import "dotenv/config";
import mongoose from "mongoose";
type ObjectId = mongoose.Types.ObjectId;
const ObjectId = mongoose.Types.ObjectId;
import { hashPassword } from "better-auth/crypto";
import { connectDB } from "../lib/db.js";
import { Transaction } from "../models/transaction.model.js";
import { MenuItem } from "../models/menuItem.model.js";

async function seedSubscriptionsAndTestAccounts() {
  await connectDB();
  const db = mongoose.connection.db!;
  const now = new Date();
  console.log("Connected to database. Seeding subscriptions and test accounts...");

  // 1. Premium Vendors: Ensure plan is "premium" and seed verified paid transactions
  const premiumVendors = [
    {
      email: "napoli@pizzahub.com",
      businessName: "Bella Napoli Wood-Fired",
      daysAgo: 25,
      amount: 29.99,
      sessionId: "cs_test_a1b2c3d4e5f6g7h8i9j0k1l2m3",
      subId: "sub_1Qn8Xa31qaq3fBvm01a2b3c4",
    },
    {
      email: "artisan@pizzahub.com",
      businessName: "Artisan Crust Pizzeria",
      daysAgo: 18,
      amount: 29.99,
      sessionId: "cs_test_b2c3d4e5f6g7h8i9j0k1l2m3n4",
      subId: "sub_1Qn8Yb31qaq3fBvm05c6d7e8",
    },
    {
      email: "brooklyn@pizzahub.com",
      businessName: "Brooklyn Slice & Oven",
      daysAgo: 10,
      amount: 29.99,
      sessionId: "cs_test_c3d4e5f6g7h8i9j0k1l2m3n4o5",
      subId: "sub_1Qn8Zc31qaq3fBvm09e0f1g2",
    },
    {
      email: "roma@pizzahub.com",
      businessName: "Roma Brick Oven & Gelato",
      daysAgo: 3,
      amount: 29.99,
      sessionId: "cs_test_d4e5f6g7h8i9j0k1l2m3n4o5p6",
      subId: "sub_1Qn8Zd31qaq3fBvm13g4h5i6",
    },
  ];

  for (const pv of premiumVendors) {
    const user = await db.collection("user").findOne({ email: pv.email });
    if (!user) {
      console.warn(`Vendor ${pv.email} not found in DB. Run seed:pizzas first.`);
      continue;
    }

    const vendorId = user._id;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Update user to premium
    await db.collection("user").updateOne(
      { _id: vendorId },
      {
        $set: {
          subscriptionPlan: "premium",
          subscriptionExpiresAt: expiresAt,
          isBlocked: false,
          updatedAt: now,
        },
      }
    );

    // Create / upsert paid transaction record for this vendor
    const txDate = new Date(Date.now() - pv.daysAgo * 24 * 60 * 60 * 1000);
    await Transaction.findOneAndUpdate(
      { stripeSessionId: pv.sessionId },
      {
        $set: {
          vendorId,
          plan: "premium",
          amount: pv.amount,
          currency: "usd",
          stripeSessionId: pv.sessionId,
          stripeSubscriptionId: pv.subId,
          status: "paid",
          createdAt: txDate,
          updatedAt: txDate,
        },
      },
      { upsert: true, new: true }
    );

    console.log(`✓ Premium subscription & paid transaction seeded for: ${pv.businessName} (${pv.email})`);
  }

  // 2. Free Tier Vendor for testing Upgrade to Premium flow & 3-item limit
  const freeVendorEmail = "freevendor@pizzahub.com";
  let freeVendorId: ObjectId;
  const existingFreeVendor = await db.collection("user").findOne({ email: freeVendorEmail });

  if (existingFreeVendor) {
    freeVendorId = existingFreeVendor._id as ObjectId;
    await db.collection("user").updateOne(
      { _id: freeVendorId },
      {
        $set: {
          name: "Mario Rossi (Free Tier)",
          businessName: "Mario's Pizza Corner (Free Tier)",
          role: "vendor",
          subscriptionPlan: "free",
          subscriptionExpiresAt: null,
          isBlocked: false,
          updatedAt: now,
        },
      }
    );
  } else {
    freeVendorId = new ObjectId();
    await db.collection("user").insertOne({
      _id: freeVendorId,
      name: "Mario Rossi (Free Tier)",
      email: freeVendorEmail,
      emailVerified: true,
      image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80",
      role: "vendor",
      isBlocked: false,
      businessName: "Mario's Pizza Corner (Free Tier)",
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const vendorPasswordHash = await hashPassword("Vendor123");
    await db.collection("account").insertOne({
      userId: freeVendorId,
      providerId: "credential",
      accountId: freeVendorId.toHexString(),
      password: vendorPasswordHash,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`✓ Free tier vendor ready: freevendor@pizzahub.com / Vendor123`);

  // Ensure Free Vendor has exactly 3 items to demonstrate the free plan limit
  const freeItems = [
    {
      itemName: "Mario's Classic Thin Crust Margherita",
      category: "Classic Pizzas",
      description: "Crispy Italian-style crust topped with San Marzano tomato sauce, fresh mozzarella, and aromatic basil.",
      price: 13.99,
      location: "Mirpur 10, Dhaka",
      images: ["https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80"],
    },
    {
      itemName: "Mario's Cheesy Garlic Bread Sticks",
      category: "Sides & Appetizers",
      description: "Freshly baked dough loaded with roasted garlic butter, parsley, and melted Italian mozzarella.",
      price: 6.99,
      location: "Mirpur 10, Dhaka",
      images: ["https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80"],
    },
    {
      itemName: "Mario's Farmhouse Mushroom Delight",
      category: "Vegetarian Pizzas",
      description: "Sautéed wild forest mushrooms, baby spinach, caramelized onions, and fontina cheese on olive oil crust.",
      price: 15.50,
      location: "Mirpur 10, Dhaka",
      images: ["https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"],
    },
  ];

  for (const fi of freeItems) {
    await MenuItem.findOneAndUpdate(
      { itemName: fi.itemName },
      {
        $set: {
          vendorId: freeVendorId,
          itemName: fi.itemName,
          category: fi.category,
          description: fi.description,
          price: fi.price,
          location: fi.location,
          images: fi.images,
          status: "approved",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }
  console.log(`✓ Seeded 3 items for Mario (Free Tier Vendor) to demonstrate 3-item limit.`);

  // 3. Customer Test Account
  const customerEmail = "customer@pizzahub.com";
  let customerId: ObjectId;
  const existingCustomer = await db.collection("user").findOne({ email: customerEmail });

  if (existingCustomer) {
    customerId = existingCustomer._id as ObjectId;
    await db.collection("user").updateOne(
      { _id: customerId },
      {
        $set: {
          name: "Alex Customer",
          role: "customer",
          isBlocked: false,
          updatedAt: now,
        },
      }
    );
  } else {
    customerId = new ObjectId();
    await db.collection("user").insertOne({
      _id: customerId,
      name: "Alex Customer",
      email: customerEmail,
      emailVerified: true,
      image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
      role: "customer",
      isBlocked: false,
      businessName: null,
      subscriptionPlan: "free",
      subscriptionExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const custPasswordHash = await hashPassword("Customer123");
    await db.collection("account").insertOne({
      userId: customerId,
      providerId: "credential",
      accountId: customerId.toHexString(),
      password: custPasswordHash,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`✓ Customer test account ready: customer@pizzahub.com / Customer123`);

  // Ensure customer has sample orders
  const samplePizza = await MenuItem.findOne({ status: "approved" });
  if (samplePizza) {
    const existingCustOrders = await db.collection("orders").countDocuments({ customerId });
    if (existingCustOrders === 0) {
      const ordersToSeed = [
        {
          itemId: samplePizza._id,
          vendorId: samplePizza.vendorId,
          customerId,
          deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          deliveryAddress: "House 42, Road 11, Banani, Dhaka",
          message: "Please include extra chili flakes and oregano packets.",
          status: "pending",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        {
          itemId: samplePizza._id,
          vendorId: samplePizza.vendorId,
          customerId,
          deliveryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          deliveryAddress: "Apartment 5B, Gulshan 1, Dhaka",
          message: "Contactless delivery please, ring the bell.",
          status: "accepted",
          createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        {
          itemId: samplePizza._id,
          vendorId: samplePizza.vendorId,
          customerId,
          deliveryDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split("T")[0],
          deliveryAddress: "Flat 3A, Dhanmondi 4, Dhaka",
          message: "Late night craving order.",
          status: "rejected",
          createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      ];
      await db.collection("orders").insertMany(ordersToSeed);
      console.log(`✓ Seeded ${ordersToSeed.length} sample customer orders.`);
    }
  }

  // Summary
  const [totalUsers, totalVendors, totalCustomers, totalTxs, paidTxs] = await Promise.all([
    db.collection("user").countDocuments({}),
    db.collection("user").countDocuments({ role: "vendor" }),
    db.collection("user").countDocuments({ role: "customer" }),
    Transaction.countDocuments({}),
    Transaction.countDocuments({ status: "paid" }),
  ]);

  console.log(`\n========================================`);
  console.log(`Seeding complete! Summary:`);
  console.log(`- Total Users: ${totalUsers} (Vendors: ${totalVendors}, Customers: ${totalCustomers})`);
  console.log(`- Total Transactions: ${totalTxs} (Paid: ${paidTxs})`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

seedSubscriptionsAndTestAccounts().catch((err) => {
  console.error("Subscription seeding error:", err);
  process.exit(1);
});
