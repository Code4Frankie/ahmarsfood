// Copy for the two local pages. Only facts we can stand behind: where we are, what we sell, how ordering and paying work.
// No opening hours, no delivery-time promises, no price claims (the real numbers show on the dish pages and at checkout).
export const LANDING_PATHS = { lafia: '/food-delivery-lafia', ful: '/food-delivery-federal-university-lafia' };

export const LANDING = {
  lafia: {
    path: LANDING_PATHS.lafia,
    title: 'Food Delivery in Lafia | Ahmars Food',
    description: 'Order amala, pounded yam, jollof rice and shawarma from Ahmars Food, delivered in Lafia. Pay online and track your rider.',
    h1: 'Food delivery in Lafia',
    crumb: 'Food delivery in Lafia',
    intro: [
      'Ahmars Food is a Nigerian restaurant at Maraba Akunza, Federal University Lafia, Nasarawa State. Order amala, pounded yam, jollof rice, fried rice, shawarma and chilled drinks online and have them delivered to you in Lafia.',
    ],
    sections: [
      { heading: 'What you can order', body: ['Our menu is grouped into swallow and soups, rice, shawarma and drinks. Every dish has its own page with the price and how long it takes to prepare.'], dishes: true },
      { heading: 'How ordering works', steps: ['Choose your dishes, or ask the Ahmars assistant to help you pick.', 'Drop a pin where you want the food, then pay online with Paystack (card, bank transfer or USSD) or Opay.', 'Follow your order: once a rider picks it up you can see them on the map and call them.'] },
      { heading: 'Where we deliver', delivery: true },
    ],
    faq: [
      { q: 'Where is Ahmars Food?', a: 'At Maraba Akunza, Federal University Lafia, Nasarawa State.' },
      { q: 'How do I pay?', a: 'Online with Paystack (card, bank transfer or USSD) or Opay, when you place your order.' },
      { q: 'How much is delivery?', a: 'It depends on the distance from the restaurant. The fee is shown at checkout before you pay.' },
      { q: 'Can I follow my order?', a: 'Yes. Your order page shows each step, and once a rider has your food you can see where they are.' },
    ],
  },
  ful: {
    path: LANDING_PATHS.ful,
    title: 'Food Delivery at Federal University Lafia | Ahmars Food',
    description: 'Hungry at Federal University Lafia or Maraba Akunza? Order Nigerian food and shawarma from Ahmars Food, pay online, and track your rider.',
    h1: 'Food delivery at Federal University Lafia',
    crumb: 'Federal University Lafia',
    intro: [
      'Studying or living around Federal University Lafia and Maraba Akunza? Ahmars Food is based at Maraba Akunza and delivers Nigerian meals, shawarma and drinks to your hostel or gate.',
    ],
    sections: [
      { heading: 'Order from your hostel', body: ['At checkout, drop the pin on your hostel and type the hostel or gate name in the address box. Add a landmark if it helps. The rider calls the phone number you give, so keep it on.'] },
      { heading: 'Pay your way', body: ['Pay online with Paystack (card, bank transfer or USSD) or with Opay, right when you place your order.'] },
      { heading: 'Dishes to start with', dishes: true },
      { heading: 'Where we deliver', delivery: true },
    ],
    faq: [
      { q: 'Do you deliver to hostels?', a: 'Yes, as long as the hostel is inside our delivery area. Drop the pin there and add the hostel or gate name.' },
      { q: 'How do I pay?', a: 'Online with Paystack (card, bank transfer or USSD) or Opay, when you place your order.' },
      { q: 'Do I need an account?', a: 'Yes. A quick sign-up with your phone number lets you pay, track the order and call your rider.' },
      { q: 'Where is the restaurant?', a: 'At Maraba Akunza, Federal University Lafia.' },
    ],
  },
};
