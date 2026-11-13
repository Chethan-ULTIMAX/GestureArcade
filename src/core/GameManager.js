/**
 * Owns the active game lifecycle.
 *
 * Each game module registered here must expose:
 *   mount({ root, gameId, input, onExit, options })
 *   dispose()
 *
 * A module should create its scene, listeners and animation loop inside mount,
 * then release every owned resource inside dispose.
 */
export class GameManager extends EventTarget {
  #modules = new Map();
  #active = null;

  get activeGameId() {
    return this.#active?.id ?? null;
  }

  register(gameId, implementation) {
    if (!gameId || !implementation || typeof implementation.mount !== "function") {
      throw new TypeError("A game needs an id and a mount() implementation.");
    }

    if (this.#modules.has(gameId)) {
      throw new Error(`A game module is already registered for "${gameId}".`);
    }

    this.#modules.set(gameId, implementation);
    this.dispatchEvent(new CustomEvent("registrychange", { detail: { gameId } }));
  }

  has(gameId) {
    return this.#modules.has(gameId);
  }

  async launch(gameId, root, context = {}) {
    const implementation = this.#modules.get(gameId);
    if (!implementation) {
      throw new Error(`The "${gameId}" game module has not been registered yet.`);
    }

    await this.stop();
    const session = {
      id: gameId,
      implementation,
      root,
      disposed: false
    };

    this.#active = session;
    try {
      await implementation.mount({
        root,
        gameId,
        input: context.input ?? null,
        options: context.options ?? {},
        onExit: () => this.stop()
      });
      this.dispatchEvent(new CustomEvent("gamestart", { detail: { gameId } }));
      return true;
    } catch (error) {
      this.#active = null;
      root?.replaceChildren();
      this.dispatchEvent(new CustomEvent("gameerror", { detail: { gameId, error } }));
      throw error;
    }
  }

  async stop() {
    const session = this.#active;
    if (!session || session.disposed) return;

    session.disposed = true;
    this.#active = null;
    try {
      await session.implementation.dispose?.();
    } finally {
      session.root?.replaceChildren();
      this.dispatchEvent(new CustomEvent("gamestop", { detail: { gameId: session.id } }));
    }
  }

  async dispose() {
    await this.stop();
    this.#modules.clear();
  }
}
