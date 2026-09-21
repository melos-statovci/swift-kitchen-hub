import assert from "node:assert/strict";
import { io } from "socket.io-client";

const API_URL = process.env.DUA_API_URL ?? "http://127.0.0.1:3101";
const PASSWORD = process.env.DUA_DEV_SEED_PASSWORD ?? "dua-local-staff-only-2026";

async function request(path, { method = "GET", token, body, expected = 200 } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(payload)}`,
  );
  return payload;
}

async function login(email) {
  const payload = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  return payload.token;
}

function waitForSocket(socket, event, predicate = () => true, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for Socket.IO event ${event}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function aggregateBody(item, variantTransform = (variant) => variant) {
  return {
    name: item.name,
    description: item.description,
    price: item.price,
    variantMode: item.variantMode,
    category: item.category,
    imageUrl: item.imageUrl,
    available: item.available,
    expectedUpdatedAt: item.updatedAt,
    variants: item.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: variant.price,
      sortOrder: variant.sortOrder,
      available: variant.available,
      ...variantTransform(variant),
    })),
  };
}

async function progressToReady(orderId, acceptanceToken, kitchenToken) {
  await request(`/api/orders/${orderId}/accept`, {
    method: "POST",
    token: acceptanceToken,
    body: {},
  });
  const kitchenOrders = await request("/api/orders", { token: kitchenToken });
  const kitchenOrder = kitchenOrders.orders.find((order) => order.id === orderId);
  assert.ok(kitchenOrder, "accepted order is visible to kitchen");
  assert.ok(
    kitchenOrder.items.some((item) => item.variantNameSnapshot),
    "kitchen order contains the immutable pizza-size snapshot",
  );
  await request(`/api/orders/${orderId}/start`, {
    method: "POST",
    token: kitchenToken,
    body: {},
  });
  await request(`/api/orders/${orderId}/ready`, {
    method: "POST",
    token: kitchenToken,
    body: {},
  });
}

async function main() {
  const health = await request("/health");
  assert.equal(health.ok, true);

  const [adminToken, acceptanceToken, kitchenToken, driverToken] = await Promise.all([
    login("admin@dua.local"),
    login("acceptance@dua.local"),
    login("kitchen@dua.local"),
    login("driver@dua.local"),
  ]);

  const categoriesPayload = await request("/api/categories");
  assert.deepEqual(
    categoriesPayload.categories.map(({ slug, name }) => ({ slug, name })),
    [
      { slug: "pizza", name: "Pizza" },
      { slug: "sandwich", name: "Sandwich" },
      { slug: "pije", name: "Pije" },
    ],
  );

  const menuPayload = await request("/api/menu");
  assert.equal(menuPayload.items.length, 16, "public menu has the 16 DUA products");
  const pizzas = menuPayload.items.filter((item) => item.category === "pizza");
  const flatItems = menuPayload.items.filter((item) => item.category !== "pizza");
  assert.equal(pizzas.length, 9);
  for (const pizza of pizzas) {
    assert.equal(pizza.variantMode, "REQUIRED");
    assert.deepEqual(
      pizza.variants.map((variant) => variant.name),
      ["E Vogël", "E Mesme", "E Madhe", "Familjare"],
    );
  }
  assert.equal(flatItems.length, 7);
  assert.ok(flatItems.every((item) => item.variantMode === "NONE" && item.variants.length === 0));

  const hours = {
    monOpen: "10:00",
    monClose: "02:00",
    tueOpen: "10:00",
    tueClose: "02:00",
    wedOpen: "10:00",
    wedClose: "02:00",
    thuOpen: "10:00",
    thuClose: "02:00",
    friOpen: "10:00",
    friClose: "02:00",
    satOpen: "10:00",
    satClose: "02:00",
    sunOpen: "10:00",
    sunClose: "02:00",
  };
  await request("/api/settings", { method: "PATCH", token: adminToken, body: hours });
  const settingsPayload = await request("/api/settings");
  assert.equal(settingsPayload.settings.deliveryFee, 0);
  assert.ok(
    Object.values(settingsPayload.settings.hours).every(
      (day) => day.open === "10:00" && day.close === "02:00",
    ),
  );

  const socket = io(API_URL, {
    auth: { token: acceptanceToken },
    transports: ["websocket", "polling"],
    forceNew: true,
  });
  await waitForSocket(socket, "connected", (payload) => payload.role === "acceptance");

  try {
    const margherita = pizzas.find((item) => item.id === "margherita");
    const cocaCola = flatItems.find((item) => item.id === "coca-cola");
    const tuna = pizzas.find((item) => item.id === "tuna");
    assert.ok(margherita && cocaCola && tuna);

    const pickupCreatedEvent = waitForSocket(
      socket,
      "order:created",
      (order) => order.fulfillmentType === "PICKUP",
    );
    const pickupPayload = await request("/api/orders", {
      method: "POST",
      expected: 201,
      body: {
        customer: { name: "DUA Pickup Test", phone: "+383000000001", notes: "Phase 2A" },
        fulfillmentType: "PICKUP",
        items: [
          {
            menuItemId: margherita.id,
            variantId: margherita.variants[0].id,
            quantity: 1,
          },
          { menuItemId: cocaCola.id, quantity: 1 },
        ],
      },
    });
    const pickup = pickupPayload.order;
    assert.equal(pickup.fulfillmentType, "PICKUP");
    assert.equal(pickup.customerAddress, null);
    assert.equal(pickup.subtotal, 400);
    assert.equal(pickup.total, 400);
    assert.equal((await pickupCreatedEvent).id, pickup.id);

    const acceptanceOrders = await request("/api/orders", { token: acceptanceToken });
    assert.equal(
      acceptanceOrders.orders.find((order) => order.id === pickup.id)?.fulfillmentType,
      "PICKUP",
    );

    const pickupUpdatedEvent = waitForSocket(
      socket,
      "order:updated",
      (order) => order.id === pickup.id && order.status === "ACCEPTED",
    );
    await progressToReady(pickup.id, acceptanceToken, kitchenToken);
    assert.equal((await pickupUpdatedEvent).status, "ACCEPTED");
    const pickupComplete = await request(`/api/orders/${pickup.id}/complete`, {
      method: "POST",
      token: acceptanceToken,
      body: { notifyCustomer: true },
    });
    assert.equal(pickupComplete.order.status, "DELIVERED");

    const deliveryPayload = await request("/api/orders", {
      method: "POST",
      expected: 201,
      body: {
        customer: {
          name: "DUA Delivery Test",
          phone: "+383000000002",
          address: "Local development address",
          notes: "Phase 2A",
        },
        fulfillmentType: "DELIVERY",
        items: [{ menuItemId: tuna.id, variantId: tuna.variants[1].id, quantity: 1 }],
      },
    });
    const delivery = deliveryPayload.order;
    assert.equal(delivery.fulfillmentType, "DELIVERY");
    assert.equal(delivery.subtotal, 700);
    assert.equal(delivery.deliveryFee, 0);

    await progressToReady(delivery.id, acceptanceToken, kitchenToken);
    const driverOrders = await request("/api/orders", { token: driverToken });
    assert.ok(driverOrders.orders.some((order) => order.id === delivery.id));
    assert.ok(driverOrders.orders.every((order) => order.fulfillmentType === "DELIVERY"));
    await request(`/api/orders/${delivery.id}/claim`, {
      method: "POST",
      token: driverToken,
      body: {},
    });
    await request(`/api/orders/${delivery.id}/take`, {
      method: "POST",
      token: driverToken,
      body: {},
    });
    const delivered = await request(`/api/orders/${delivery.id}/deliver`, {
      method: "POST",
      token: driverToken,
      body: {},
    });
    assert.equal(delivered.order.status, "DELIVERED");

    // Prove an admin aggregate edit works and historical tickets keep their
    // original size/price snapshots even after the live variant is renamed.
    const adminMenu = await request("/api/menu/all", { token: adminToken });
    const adminMargherita = adminMenu.items.find((item) => item.id === "margherita");
    assert.ok(adminMargherita);
    const originalSmall = adminMargherita.variants.find(
      (variant) => variant.id === "margherita-e-vogel",
    );
    assert.ok(originalSmall);
    const editedPayload = await request(`/api/menu/${adminMargherita.id}/aggregate`, {
      method: "PATCH",
      token: adminToken,
      body: aggregateBody(adminMargherita, (variant) =>
        variant.id === originalSmall.id
          ? { name: "E Vogël — edit test", price: variant.price + 1 }
          : {},
      ),
    });
    try {
      const trackedPickup = await request(`/api/orders/track/${pickup.trackingToken}`);
      const historicalPizza = trackedPickup.order.items.find(
        (item) => item.menuItemId === "margherita",
      );
      assert.equal(historicalPizza.variantNameSnapshot, "E Vogël");
      assert.equal(historicalPizza.priceSnapshot, 250);
    } finally {
      await request(`/api/menu/${adminMargherita.id}/aggregate`, {
        method: "PATCH",
        token: adminToken,
        body: aggregateBody(editedPayload.item, (variant) =>
          variant.id === originalSmall.id
            ? { name: originalSmall.name, price: originalSmall.price }
            : {},
        ),
      });
    }
  } finally {
    socket.disconnect();
  }

  console.log("✅ DUA Phase 2A API/realtime validation passed");
  console.log(
    "   staff login, menu/variants, overnight hours, pickup, delivery, snapshots, Socket.IO",
  );
}

main().catch((error) => {
  console.error("❌ DUA Phase 2A validation failed");
  console.error(error);
  process.exitCode = 1;
});
