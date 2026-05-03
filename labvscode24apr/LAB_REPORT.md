# Lab Assignment Report

## Part 1: Real-Time Collaborative Application
**Objective:** Design a shared document editor where multiple users can edit data simultaneously.

### Task 1: System Architecture & Real-Time Protocols
#### Proposed Architecture
The system follows a client-server architecture containing:
1. **Client Layer:** A frontend application holding the local state of the document.
2. **Server Layer:** A backend server running a REST API (for initial data and authentication) and a WebSocket server (for real-time live syncing).
3. **Data Layer:** A central store for Document Content, Access Control Lists (ACLs), and User Profiles.

#### The Role of WebSockets
Traditional HTTP relies on a *Request-Response* model. If users relied on HTTP, the client would have to constantly ask the server, "Are there any updates?" (Polling). This creates massive server overhead and latency. 
WebSockets provide a **persistent, full-duplex (bi-directional) communication channel** over a single TCP connection. The server can automatically *push* keystrokes to connected clients the millisecond they occur, ensuring low-latency collaboration.

**Lab Implementation:**
We implemented a monolithic Node.js/Express server with `Socket.io`. For the client, we used plain HTML/Vanilla JS to avoid build-step overhead. The database is simulated via in-memory JavaScript objects.
**Production Implementation:**
A production app would use an API Gateway, a distributed cache like Redis (to allow Socket.io to scale across multiple server instances via Redis Adapters), and a robust database like PostgreSQL or MongoDB.

---

### Task 2: Managing Simultaneous Edits
When User A and User B edit the exact same sentence simultaneously, simply overwriting the string causes data loss. We must send *operations* and intelligently resolve conflicts.

#### Operational Transformation (OT)
OT relies on a central server to dictate the final order of operations and "transform" incoming edits based on absolute index positions.
*   **Example:** Document is "Cat". User A inserts 's' at index 3. User B inserts 'h' at index 1. If the server applies User B first ("Chat"), User A's target index (3) is no longer valid. The server *transforms* User A's operation by shifting the index +1, making it `Insert('s', index: 4)`, resulting in "Chats".

#### Conflict-free Replicated Data Types (CRDT)
CRDT is a decentralized, mathematically sound approach. It treats the document as a list of characters where **every character has a unique, fractional ID**.
*   **Example:** 'C'(0.2), 'a'(0.5), 't'(0.8). User A inserts 's' at ID 0.9. User B inserts 'h' at ID 0.3. Because operations are tied to universal IDs, the order they arrive does not matter. The clients simply sort by ID: 0.2(C), 0.3(h), 0.5(a), 0.8(t), 0.9(s). No central server is strictly required for conflict resolution.

**Lab Implementation:**
We implemented a "Naive OT" in Vanilla JS. The client calculates basic diffs (inserts/deletes) and emits atomic operations (e.g., `{ type: 'insert', index: 5, text: 'a' }`) to the server, which splices them into the string. This prevents cursor jumping for active users.
**Production Implementation:**
Due to extreme mathematical complexity, the industry standard is to use open-source CRDT libraries like **Yjs** or **Automerge**, which bind directly to text editors (like Quill or ProseMirror) and automatically handle fractional indexing and memory optimization.

---

### Task 3: Authentication and Role-Based Access Control (RBAC)
To secure the document, we must identify users and verify their permissions before broadcasting their edits.

**Lab Implementation:**
1. **Auth:** We created a standard REST endpoint (`/api/login`) that accepts credentials and returns a signed **JSON Web Token (JWT)**.
2. **WebSocket Handshake:** The client passes this JWT when initiating the `Socket.io` connection. A server middleware validates the JWT signature and attaches the username to the socket.
3. **RBAC:** Users have roles (`Owner`, `Editor`, `Viewer`). The frontend disables the UI for `Viewers`. Crucially, when an `edit` event reaches the server, the server re-verifies the user's role on the server-side before applying the operation, preventing malicious frontend tampering.

**Production Implementation:**
Auth would utilize OAuth2.0 / OIDC integrations (Google/GitHub login), secure HTTP-only cookies, and short-lived access tokens combined with refresh tokens.

***

## Part 2: Fault-Tolerant Data Fetching System
**Objective:** Design a data fetching system that handles network flakiness, deduplicates requests, and ensures consistency.

### Task 1: Exponential Backoff Retries
When an API goes down or the network drops, hammering the server with immediate retries exacerbates the outage. Exponential backoff involves waiting increasingly longer periods (e.g., 1s, 2s, 4s) between failure retries.

**Lab Implementation:**
We built a custom `robustFetch` wrapper. Using an asynchronous `while` loop, if a `fetch()` throws an error, the code awaits a `setTimeout` that doubles its delay interval upon every subsequent failure, capping at a maximum retry limit.

### Task 2 & 4: Network Failures, Offline Mode & Data Consistency
If a user completely loses internet, the UI should not break; it should gracefully degrade to a cached state to preserve data consistency.

**Lab Implementation:**
Using the native `navigator.onLine` and `window.addEventListener('offline')`, the app detects disconnections and immediately displays a yellow offline warning banner. Inside the `robustFetch` wrapper, every successful response is stringified and saved to `localStorage`. If max retries are hit or the browser is offline, the fetcher catches the error and cleanly returns the `localStorage` fallback data instead.

### Task 3: Prevent Duplicate Requests (Deduplication)
If multiple UI components mount simultaneously and request the exact same data resource, the network shouldn't be clogged with redundant identical requests.

**Lab Implementation:**
We implemented request collapsing. We created an `inFlightRequests` Map. When `robustFetch` is called, it checks if a Promise for that exact URL already exists in the Map. If it does, the function simply returns the existing Promise rather than initiating a new network call. Once the Promise resolves, the data is handed to both components simultaneously, and the key is cleared from the Map.

### How It Is Handled in a Real Production App
In modern industry applications, developers do not write manual `robustFetch` wrappers utilizing `setTimeout` loops.

1. **Client-Side Data Management Hooks:** Enterprise apps use libraries like **React Query (@tanstack/react-query)**, **SWR**, or **Apollo Client**. These libraries natively handle deduplication, exponential backoff, caching, and background refetching out-of-the-box.
2. **Service Workers & PWAs (Progressive Web Apps):** For offline consistency, apps use Service Workers to cache network requests and serve them via a Cache Storage API. They also use Background Sync queues to hold onto optimistic user edits (Optimistic UI) and dispatch them silently once the device reconnects to a 5G network.
3. **Service Mesh (Infrastructure):** In architectures like Kubernetes, tools like **Envoy** or **Istio** handle retry logic at the proxy layer before the failure is even surfaced to the application frontend.
