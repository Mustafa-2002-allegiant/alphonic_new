// firebase.mock.js
console.log("🔥 MOCK Firebase Firestore Loaded");

const fakeDoc = (id = "mockId", data = {}) => ({
  id,
  data: () => data,
  ref: { update: async () => {} },
  exists: true,
});

const fakeCollection = () => ({
  doc: (id) => ({
    set: async () => {},
    get: async () => fakeDoc(id),
  }),
  add: async () => {},
  where: () => ({
    get: async () => ({ empty: true, docs: [] }),
  }),
  get: async () => ({
    docs: [
      fakeDoc("agent123", { agentId: "agent123", isActive: true }),
      fakeDoc("agent456", { agentId: "agent456", isActive: true }),
    ],
  }),
});

module.exports = {
  getFirestore: () => ({
    collection: fakeCollection,
    batch: () => ({
      update: () => {},
      set: () => {},
      commit: async () => {},
    }),
  }),
  initializeApp: () => {},
  cert: () => {},
};
