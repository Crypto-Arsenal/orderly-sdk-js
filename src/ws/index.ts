import { WsPublicUrl, WsPrivateUrl } from '../enums';
import { SDKConfigurationOptions } from '../interfaces/configuration';
import {
  getOrderlyKeyPair,
  getTradingKeyPair,
  signMessageByTradingKey,
  signPostRequestByOrderlyKey,
} from '../rest/utils/order.signature.secp256k1';

export class WebSocketManager {
    public url: string;
    public privateUrl: string;
    public websocket: any;
    public privateWebsocket: any;
    public subscriptions: any;
    public privateSubscriptions: any;
    public messageCallback: any;
    public messageCallbackPrivate: any;
    public pingTimer: any;
    public pingInterval: number;
    public pingTimerPrivate: any;

    constructor(private sdkOptions: SDKConfigurationOptions) {
      this.url = `${WsPublicUrl[this.sdkOptions.networkId]}${this.sdkOptions.accountId}`;
      this.privateUrl = `${WsPrivateUrl[this.sdkOptions.networkId]}${this.sdkOptions.accountId}`;
      this.privateWebsocket = null;
      this.websocket = null;
      this.subscriptions = new Set();
      this.privateSubscriptions = new Set();
      this.pingInterval = 10000; // Ping interval in milliseconds (30 seconds)
      this.pingTimer = null;
      this.pingTimerPrivate = null;
    }

    connectPrivate() {
      this.privateWebsocket = new WebSocket(this.privateUrl);

      this.privateWebsocket.onopen = async () => {
        console.log('WebSocket connection established.');
        // Subscribe to existing subscriptions
        this.privateSubscriptions.forEach((subscription) => {
          this.sendPrivateSubscription(subscription);
        });

        console.log('start to generate ws key');

        const timestamp = new Date().getTime().toString();

        const messageStr = [
          timestamp,
        ].join('');

        const messageBytes = new TextEncoder().encode(messageStr);
        const keyPair = await getOrderlyKeyPair(this.sdkOptions.orderlyKeyPrivate);
        const orderlySign = signPostRequestByOrderlyKey(keyPair, messageBytes);

        const payload = {
          "id":"123r",
          "event":"auth",
          "params":{
              "orderly_key": this.sdkOptions.publicKey,
              "sign": orderlySign,
              "timestamp": timestamp
          }
        }

        this.privateWebsocket.send(JSON.stringify(payload))

        this.startPingPrivate()

        this.privateWebsocket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);
          if (this.messageCallbackPrivate) {
            this.messageCallbackPrivate(message);
          }
        };
    
        this.privateWebsocket.onclose = () => {
          console.log('WebSocket private connection closed.');
          this.stopPingPrivate();
        };
    
        this.privateWebsocket.onerror = (error) => {
          console.error('WebSocket private connection error:', error);
        };
      };
    }

  
    connect() {
      this.websocket = new WebSocket(this.url);
  
      this.websocket.onopen = () => {
        console.log('WebSocket connection established.');
        // Subscribe to existing subscriptions
        this.subscriptions.forEach((subscription) => {
          this.sendSubscription(subscription);
        });
        this.startPing();
      };
  
      this.websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message:', message);
        if (this.messageCallback) {
          this.messageCallback(message);
        }
      };
  
      this.websocket.onclose = () => {
        console.log('WebSocket connection closed.');
        this.stopPing();
      };
  
      this.websocket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
      };
    }
  
    disconnect() {
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
        console.log('WebSocket connection disconnected.');
        this.stopPing();
      }
    }

    disconnectPrivate() {
      if (this.privateWebsocket) {
        this.privateWebsocket.close();
        this.privateWebsocket = null;
        console.log('WebSocket private connection disconnected.');
        this.stopPingPrivate();
      }
    }
  
    sendSubscription(subscription) {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(subscription));
        console.log('Sent subscription:', subscription);
        this.subscriptions.add(subscription);
      } else {
        console.warn('WebSocket connection not open. Subscription not sent.');
      }
    }

    sendPrivateSubscription(subscription) {
      if (this.privateWebsocket && this.privateWebsocket.readyState === WebSocket.OPEN) {
        this.privateWebsocket.send(JSON.stringify(subscription));
        console.log('Sent subscription private:', subscription);
        this.privateSubscriptions.add(subscription);
      } else {
        console.warn('Private WebSocket connection not open. Subscription not sent.');
      }
    }
  
    unsubscribe(subscription) {
      this.subscriptions.delete(subscription);
      // Unsubscribe from the server if needed
    }
  
    setMessageCallback(callback) {
      this.messageCallback = callback;
    }

    unsubscribePrivate(subscription) {
      this.privateSubscriptions.delete(subscription);
      // Unsubscribe from the server if needed
    }
  
    setPrivateMessageCallback(callback) {
      this.messageCallbackPrivate = callback;
    }

    startPing() {
        this.pingTimer = setInterval(() => {
          if (this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({event: 'pong'}));
            console.log('Sent ping request.');
          } else {
            console.warn('WebSocket connection not open. Ping request not sent.');
          }
        }, this.pingInterval);
    }
    
    stopPing() {
    if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
        console.log('Stopped ping requests.');
    }
    }

    startPingPrivate() {
      this.pingTimerPrivate = setInterval(() => {
        if (this.privateWebsocket.readyState === WebSocket.OPEN) {
          this.privateWebsocket.send(JSON.stringify({event: 'pong'}));
          console.log('Sent private ping request.');
        } else {
          console.warn('Private WebSocket connection not open. Ping request not sent.');
        }
      }, this.pingInterval);
    }
    
    stopPingPrivate() {
    if (this.pingTimerPrivate) {
        clearInterval(this.pingTimerPrivate);
        this.pingTimerPrivate = null;
        console.log('Stopped private ping requests.');
    }
    }
  }
  
  