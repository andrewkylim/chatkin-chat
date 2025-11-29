export class BrowserNotificationService {
	private permissionGranted = false;

	async requestPermission(): Promise<boolean> {
		if (!('Notification' in window)) {
			console.warn('Browser notifications not supported');
			return false;
		}

		if (Notification.permission === 'granted') {
			this.permissionGranted = true;
			return true;
		}

		if (Notification.permission === 'denied') {
			return false;
		}

		const permission = await Notification.requestPermission();
		this.permissionGranted = permission === 'granted';
		return this.permissionGranted;
	}

	canSendNotifications(): boolean {
		return 'Notification' in window && Notification.permission === 'granted';
	}

	async sendNotification(title: string, options?: globalThis.NotificationOptions): Promise<void> {
		if (!this.canSendNotifications()) {
			console.warn('Cannot send browser notification - permission not granted');
			return;
		}

		try {
			const notification = new Notification(title, {
				icon: '/favicon.png',
				badge: '/favicon.png',
				...options
			});

			// Auto-close after 10 seconds
			setTimeout(() => notification.close(), 10000);
		} catch (error) {
			console.error('Failed to send browser notification', error);
		}
	}

	async notifyTaskDueSoon(taskTitle: string, dueDate: string): Promise<void> {
		await this.sendNotification('Task Due Soon', {
			body: `${taskTitle} is due on ${new Date(dueDate).toLocaleDateString()}`,
			tag: 'task-due-soon',
			requireInteraction: false
		});
	}

	async notifyAIProposal(summary: string): Promise<void> {
		await this.sendNotification('AI Proposal', {
			body: summary,
			tag: 'ai-proposal',
			requireInteraction: true
		});
	}

	async notifyAIInsight(insight: string): Promise<void> {
		await this.sendNotification('AI Insight', {
			body: insight,
			tag: 'ai-insight',
			requireInteraction: false
		});
	}
}

export const browserNotifications = new BrowserNotificationService();
