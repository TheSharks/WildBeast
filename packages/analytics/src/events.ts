export interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  guild_id?: string;
  channel_id?: string;
  properties: Record<string, any>;
  timestamp: Date;
  session_id?: string;
}

export interface SessionData {
  session_id: string;
  user_id: string;
  start_time: Date;
  last_activity: Date;
  events: AnalyticsEvent[];
  metadata: Record<string, any>;
}

export class EventTracker {
  private sessions: Map<string, SessionData> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  track(event: AnalyticsEvent): void {
    // Ensure event has a timestamp
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Handle session management
    if (event.user_id) {
      this.updateSession(event);
    }

    // Enrich event with additional context
    this.enrichEvent(event);
  }

  private updateSession(event: AnalyticsEvent): void {
    const sessionKey = this.getSessionKey(event.user_id!, event.guild_id);
    let session = this.sessions.get(sessionKey);

    if (!session || this.isSessionExpired(session)) {
      // Create new session
      session = {
        session_id: this.generateSessionId(),
        user_id: event.user_id!,
        start_time: event.timestamp,
        last_activity: event.timestamp,
        events: [],
        metadata: {
          guild_id: event.guild_id,
          channel_id: event.channel_id,
        },
      };
      this.sessions.set(sessionKey, session);
    }

    // Update session
    session.last_activity = event.timestamp;
    session.events.push(event);
    event.session_id = session.session_id;

    // Update metadata
    if (event.channel_id) {
      session.metadata.channel_id = event.channel_id;
    }
  }

  private enrichEvent(event: AnalyticsEvent): void {
    // Add common enrichments
    event.properties = {
      ...event.properties,
      enriched_at: new Date().toISOString(),
    };

    // Add session context if available
    if (event.session_id) {
      const sessionKey = this.getSessionKey(event.user_id!, event.guild_id);
      const session = this.sessions.get(sessionKey);
      
      if (session) {
        event.properties.session_start_time = session.start_time.toISOString();
        event.properties.session_event_count = session.events.length;
        event.properties.session_duration = event.timestamp.getTime() - session.start_time.getTime();
      }
    }

    // Add event sequence information
    if (event.user_id) {
      const userSessions = this.getUserSessions(event.user_id);
      event.properties.user_total_sessions = userSessions.length;
      event.properties.user_total_events = userSessions.reduce((sum, s) => sum + s.events.length, 0);
    }
  }

  private getSessionKey(userId: string, guildId?: string): string {
    return guildId ? `${userId}:${guildId}` : userId;
  }

  private isSessionExpired(session: SessionData): boolean {
    return Date.now() - session.last_activity.getTime() > this.sessionTimeout;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupExpiredSessions(): void {
    const expiredSessions: string[] = [];
    
    for (const [key, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(key);
      }
    }

    for (const key of expiredSessions) {
      this.sessions.delete(key);
    }
  }

  // Helper methods for common event types
  trackCommand(userId: string, guildId: string, channelId: string, command: string, args: any[], duration: number, success: boolean): void {
    this.track({
      event_type: 'command_executed',
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      timestamp: new Date(),
      properties: {
        command,
        args,
        duration,
        success,
      },
    });
  }

  trackMessage(userId: string, guildId: string, channelId: string, messageType: string, length: number): void {
    this.track({
      event_type: 'message_sent',
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      timestamp: new Date(),
      properties: {
        message_type: messageType,
        message_length: length,
      },
    });
  }

  trackUserJoin(userId: string, guildId: string): void {
    this.track({
      event_type: 'user_joined',
      user_id: userId,
      guild_id: guildId,
      timestamp: new Date(),
      properties: {},
    });
  }

  trackUserLeave(userId: string, guildId: string): void {
    this.track({
      event_type: 'user_left',
      user_id: userId,
      guild_id: guildId,
      timestamp: new Date(),
      properties: {},
    });
  }

  trackError(userId: string, guildId: string, channelId: string, error: Error, context: any): void {
    this.track({
      event_type: 'error_occurred',
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      timestamp: new Date(),
      properties: {
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack,
        context,
      },
    });
  }

  trackFeatureUsage(userId: string, guildId: string, feature: string, metadata: any): void {
    this.track({
      event_type: 'feature_used',
      user_id: userId,
      guild_id: guildId,
      timestamp: new Date(),
      properties: {
        feature,
        ...metadata,
      },
    });
  }

  // Session management methods
  getSession(userId: string, guildId?: string): SessionData | undefined {
    const sessionKey = this.getSessionKey(userId, guildId);
    return this.sessions.get(sessionKey);
  }

  getUserSessions(userId: string): SessionData[] {
    const sessions: SessionData[] = [];
    for (const [key, session] of this.sessions.entries()) {
      if (session.user_id === userId) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  getSessionStats(): {
    total_sessions: number;
    active_sessions: number;
    expired_sessions: number;
    avg_session_duration: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;
    let totalDuration = 0;

    for (const session of this.sessions.values()) {
      if (this.isSessionExpired(session)) {
        expiredSessions++;
      } else {
        activeSessions++;
      }
      totalDuration += session.last_activity.getTime() - session.start_time.getTime();
    }

    return {
      total_sessions: this.sessions.size,
      active_sessions: activeSessions,
      expired_sessions: expiredSessions,
      avg_session_duration: this.sessions.size > 0 ? totalDuration / this.sessions.size : 0,
    };
  }

  // Event aggregation methods
  getUserEventCount(userId: string, eventType?: string): number {
    const sessions = this.getUserSessions(userId);
    let count = 0;
    
    for (const session of sessions) {
      for (const event of session.events) {
        if (!eventType || event.event_type === eventType) {
          count++;
        }
      }
    }
    
    return count;
  }

  getGuildEventCount(guildId: string, eventType?: string): number {
    let count = 0;
    
    for (const session of this.sessions.values()) {
      if (session.metadata.guild_id === guildId) {
        for (const event of session.events) {
          if (!eventType || event.event_type === eventType) {
            count++;
          }
        }
      }
    }
    
    return count;
  }

  getRecentEvents(limit: number = 100): AnalyticsEvent[] {
    const allEvents: AnalyticsEvent[] = [];
    
    for (const session of this.sessions.values()) {
      allEvents.push(...session.events);
    }
    
    return allEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}