import { Resend } from 'resend';
import config from '../config/config.js';
import EmailQueue from '../models/emailQueue.model.js';

const PROCESSING_INTERVAL = 30 * 60 * 1000; // Check queue every 30 minutes

// Retry delays in milliseconds
const RETRY_DELAYS = [
    2 * 60 * 60 * 1000,  // 2 hours
    6 * 60 * 60 * 1000,  // 6 hours
    24 * 60 * 60 * 1000  // 24 hours
];

const resend = new Resend("re_LxXEA3aq_Hm4RHQpn26b7Js6xBBqbkKJb");

class EmailQueueService {
    constructor() {
        this.isProcessing = false;
        this.startProcessing();
    }

    async addToQueue(emailData) {
        try {
            // Check if database is connected
            if (!EmailQueue.db || EmailQueue.db.readyState !== 1) {
                console.error('Database not connected, cannot add to queue');
                throw new Error('Database not connected');
            }

            const emailJob = new EmailQueue({
                ...emailData,
                nextAttempt: Date.now()
            });
            
            await emailJob.save();
            return emailJob._id;
        } catch (error) {
            console.error('Error adding email to queue:', error);
            throw error;
        }
    }

    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // Check if database is connected using mongoose connection
            const mongoose = await import('mongoose');
            if (mongoose.default.connection.readyState !== 1) {
                console.log('Database not connected, skipping queue processing');
                return;
            }

            // Find all pending emails that are due for processing
            const pendingEmails = await EmailQueue.find({
                status: 'pending',
                nextAttempt: { $lte: new Date() }
            });

            for (const job of pendingEmails) {
                try {
                    await this.sendEmail(job);
                    
                    // Mark as completed if successful
                    job.status = 'completed';
                    await job.save();
                    
                    console.log(`Email sent successfully to ${job.email}`);
                    
                } catch (error) {
                    console.error(`Failed to send email to ${job.email}:`, error);
                    
                    if (job.attempts < RETRY_DELAYS.length) {
                        // Schedule next retry
                        job.attempts += 1;
                        job.nextAttempt = new Date(Date.now() + RETRY_DELAYS[job.attempts - 1]);
                        await job.save();
                        
                        console.log(`Will retry email to ${job.email} in ${RETRY_DELAYS[job.attempts - 1]/3600000} hours`);
                    } else {
                        job.status = 'failed';
                        await job.save();
                        console.error(`Email to ${job.email} failed permanently after all retries`);
                    }
                }
            }

            // Clean up completed jobs older than 24 hours
            const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
            await EmailQueue.deleteMany({
                status: 'completed',
                createdAt: { $lt: oneDayAgo }
            });
            
        } catch (error) {
            console.error('Error processing queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    async sendEmail(job) {
        const badgeLink = `${config.clientUrl}/member/badge/${job.token}`;

        await resend.emails.send({
            from: "MIT-WPU Science & Spirituality Forum <welcome@snsf.live>",
            to: job.email,
            replyTo: 'snsf@mitwpu.edu.in',
            subject: 'Welcome to MIT-WPU Science & Spirituality Forum',
            html: `
                <p>Dear ${job.name},</p>
                <p>Thank you for registering with MIT-WPU Science & Spirituality Forum. We are excited to have you on board.</p>
                <p>Your registration details are as follows:</p>
                <ul>
                    <li><strong>Name:</strong> ${job.name}</li>
                    <li><strong>Member ID:</strong> ${job.memId}</li>
                </ul>
                <p>Please click on the link below to view your badge:</p>
                <p><a href="${badgeLink}">View Badge</a></p>
                <p>Best regards,<br/>MIT-WPU Science & Spirituality Forum Team</p>
            `
        });
    }

    startProcessing() {
        // Process queue immediately
        this.processQueue();
        
        // Then process periodically
        setInterval(() => this.processQueue(), PROCESSING_INTERVAL);
    }
}

// Create singleton instance
const emailQueueService = new EmailQueueService();

// Export function to add emails to queue
export const addEmailToQueue = async (emailData) => {
    return await emailQueueService.addToQueue(emailData);
};

export { emailQueueService }; 