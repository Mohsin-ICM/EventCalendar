import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * SignalR service for real-time communication.
 * Handles connection to SignalR hub and broadcasts events.
 */
@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private connection: HubConnection | null = null;
  private draftUpdatedSubject = new Subject<any>();
  private schedulePublishedSubject = new Subject<any>();
  private presenceSubject = new Subject<any>();

  /**
   * Observable for draft updated events.
   */
  public draftUpdated$: Observable<any>;

  /**
   * Observable for schedule published events.
   */
  public schedulePublished$: Observable<any>;

  /**
   * Observable for presence events.
   */
  public presence$: Observable<any>;

  /**
   * Initializes a new instance of SignalRService.
   */
  constructor() {
    // Initialize observables immediately to prevent undefined errors
    this.draftUpdated$ = this.draftUpdatedSubject.asObservable();
    this.schedulePublished$ = this.schedulePublishedSubject.asObservable();
    this.presence$ = this.presenceSubject.asObservable();
  }

  /**
   * Initializes SignalR connection.
   * No authentication token needed.
   */
  async startConnection(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) {
      return;
    }

    try {
      this.connection = new HubConnectionBuilder()
        .withUrl(`${environment.apiUrl.replace('/api', '')}/realtime`)
        .withAutomaticReconnect()
        .build();

      // Register event handlers
      this.connection.on('draft.updated', (data) => {
        this.draftUpdatedSubject.next(data);
      });

      this.connection.on('schedule.published', (data) => {
        this.schedulePublishedSubject.next(data);
      });

      this.connection.on('presence', (data) => {
        this.presenceSubject.next(data);
      });

      await this.connection.start();
    } catch (error) {
      console.warn('SignalR connection failed (optional):', error);
      // SignalR is optional, so we don't throw
    }
  }

  /**
   * Stops SignalR connection.
   */
  async stopConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (error) {
        console.warn('Error stopping SignalR connection:', error);
      }
      this.connection = null;
    }
  }

  /**
   * Checks if connection is established.
   * @returns True if connected.
   */
  isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }
}

