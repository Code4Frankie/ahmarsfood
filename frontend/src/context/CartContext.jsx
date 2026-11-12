import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
const MAX_QTY = 20;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('af_cart')) || []; } catch { return []; }
  });
  useEffect(() => localStorage.setItem('af_cart', JSON.stringify(items)), [items]);

  // Prices here are for display only; the server prices the order from the database.
  const add = (food) =>
    setItems((cur) => {
      const found = cur.find((i) => i.foodId === food._id);
      if (found) return cur.map((i) => (i.foodId === food._id ? { ...i, qty: Math.min(MAX_QTY, i.qty + 1) } : i));
      return [...cur, { foodId: food._id, name: food.name, price: food.price, image: food.image, qty: 1 }];
    });
  // Used by the shopping assistant. Name and price are for display only; the server prices the order.
  const addMany = (list) =>
    setItems((cur) => {
      let next = [...cur];
      for (const it of list) {
        const found = next.find((i) => i.foodId === it.food_id);
        if (found) next = next.map((i) => (i.foodId === it.food_id ? { ...i, qty: Math.min(MAX_QTY, i.qty + it.qty) } : i));
        else next.push({ foodId: it.food_id, name: it.name, price: it.price, image: undefined, qty: Math.min(MAX_QTY, it.qty) });
      }
      return next;
    });
  const setQty = (foodId, qty) =>
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.foodId !== foodId) : cur.map((i) => (i.foodId === foodId ? { ...i, qty: Math.min(MAX_QTY, qty) } : i))));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const qtyOf = (foodId) => items.find((i) => i.foodId === foodId)?.qty || 0;

  return <CartContext.Provider value={{ items, add, addMany, setQty, clear, count, subtotal, qtyOf }}>{children}</CartContext.Provider>;
}
