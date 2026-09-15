/**
 * Shared lifecycle, settings, and event-listener management for controllers.
 */
export default class BaseClass {
  /** Shared settings service used by the controller. */
  settingsService: any;

  /** Event listeners registered through {@link addListener}. */
  eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }>;

  /** Creates a controller with the shared settings service. */
  constructor();

  /**
   * Runs an initializer after the DOM has finished loading.
   * @param initCallback Initialization callback.
   * @returns {void}
   */
  init(initCallback?: () => void | Promise<void>): void;

  /**
   * Registers and tracks an event listener for later cleanup.
   * @param element Event target that receives the listener.
   * @param event Event name to listen for.
   * @param handler Callback invoked when the event occurs.
   * @returns {void}
   */
  addListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
  ): void;

  /**
   * Removes every listener registered through {@link addListener}.
   * @returns {void}
   */
  tearDown(): void;
}
