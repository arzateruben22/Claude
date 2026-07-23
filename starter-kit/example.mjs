/* Runnable tour of the whole kit with an in-memory store.
 *   node example.mjs
 * In a browser you'd use createLocalStore() instead — everything else is identical.
 */
import { createMemoryStore } from "./core/store.js";
import { createPayments } from "./core/payments.js";
import { createRewards } from "./core/rewards.js";
import { createGiftCards } from "./core/giftcards.js";
import { createInventory } from "./core/inventory.js";
import { createScheduling } from "./core/scheduling.js";
import { createSettlements } from "./core/settlements.js";
import * as analytics from "./core/analytics.js";

const store = createMemoryStore();

const pay = createPayments({ store });
const rewards = createRewards({ store });
const gift = createGiftCards({ store, codePrefix: "GC" });
const inventory = createInventory({ store, lowStock: 3, seed: [
  { id: "cleanser", name: "Cleanser", stock: 8, cost: 18, price: 38 },
  { id: "serum", name: "Serum", stock: 3, cost: 32, price: 75 }
]});
const schedule = createScheduling({ store });
const settle = createSettlements({ store, noShowFee: 40 });

const log = (label, v) => console.log(label.padEnd(24), typeof v === "object" ? JSON.stringify(v) : v);

// 1) Scheduling — find a slot two working days out and book it
const day = schedule.dateKey(schedule.upcomingDays(3)[2]);
const slots = schedule.availableSlots(day, 60);
const booked = schedule.add({ date: day, start: slots[0], dur: 60, total: 200, deposit: 100, paid: 100,
  services: ["service-a"], name: "Ava", email: "ava@example.com", source: "web" });
log("first available slot", slots[0]);
log("deposit on $200", schedule.deposit(200));
log("booking ok?", booked.ok);
log("slot now taken?", !schedule.canBook(day, slots[0], 60));

// 2) Rewards — earn on the deposit, check redeemable blocks
rewards.claimWelcome();
rewards.award(100, { dayKey: day }, "Deposit");
log("points", rewards.points());
log("redeemable blocks(/$50)", rewards.redeemableBlocks(50));

// 3) Gift card — issue, then redeem part of it
const card = gift.create({ amount: 100, label: "Any service", recipientName: "Bee", boughtBy: "ava@example.com" });
const redeemed = gift.redeem(card.code, 60);
log("gift code", card.code);
log("gift redeem $60", redeemed);
log("gift liability", gift.liability());

// 4) Inventory — sell one online, one in person
inventory.sell("cleanser", 1, "online");
inventory.sell("serum", 1, "in-person");
log("inventory summary", inventory.summary());
log("retail sales", analytics.retailSales(inventory.sales()));

// 5) Settlements — settle the visit's balance in cash
const key = booked.booking.date + "|" + booked.booking.start + "|ava@example.com";
settle.settlePaid(key, "cash", 100);
log("settlement summary", settle.summary([{ key, total: 200, online: 100 }]));

// 6) Payments vault — save a card, read it back
pay.saveCard("ava@example.com", "4242 4242 4242 4242", "12/34");
log("card on file", pay.getCard("ava@example.com"));

// 7) Analytics — clients, retention, most-booked, bookkeeping, gift liability
const clients = analytics.buildClients(schedule.all());
log("retention", analytics.retention(clients));
log("most booked", analytics.mostBooked(schedule.all()));
log("bookkeeping totals", analytics.bookkeeping(schedule.all()).totals);
log("gift liability(analytics)", analytics.giftLiability(gift.all()));

console.log("\n✓ all engines ran.");
