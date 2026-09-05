import Recruitment from '../models/recruitment.model.js';
import RecruitmentApplication from '../models/recruitmentApplication.model.js';
import { addRecruitmentEmailToQueue } from '../queues/recruitmentEmailQueue.js';

// Get active recruitment form (public endpoint)
const getActiveRecruitment = async (req, res) => {
    try {
        const recruitment = await Recruitment.findOne({ isActive: true })
            .select('-__v')
            .sort({ createdAt: -1 });

        if (!recruitment) {
            return res.status(404).json({
                success: false,
                message: 'No Recruitment Form Active'
            });
        }

        // Check if application deadline has passed
        const now = new Date();
        if (recruitment.applicationDeadline < now) {
            return res.status(400).json({
                success: false,
                message: 'Application deadline has passed',
                closedMessage: recruitment.closedMessage
            });
        }

        // Check if max applications reached
        if (recruitment.currentApplications >= recruitment.maxApplications) {
            return res.status(400).json({
                success: false,
                message: 'Maximum applications reached',
                closedMessage: recruitment.closedMessage
            });
        }

        res.status(200).json({
            success: true,
            data: recruitment
        });
    } catch (error) {
        console.error('Error fetching active recruitment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Submit application (public endpoint)
const submitApplication = async (req, res) => {
    try {
        const { recruitmentId, applicantInfo, answers } = req.body;

        // Validate recruitment exists and is active
        const recruitment = await Recruitment.findById(recruitmentId);
        if (!recruitment || !recruitment.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Recruitment is not active'
            });
        }

        // Check deadline
        const now = new Date();
        if (recruitment.applicationDeadline < now) {
            return res.status(400).json({
                success: false,
                message: 'Application deadline has passed'
            });
        }

        // Check max applications
        if (recruitment.currentApplications >= recruitment.maxApplications) {
            return res.status(400).json({
                success: false,
                message: 'Maximum applications reached'
            });
        }

        // Note: Allowing same email to apply multiple times (removed duplicate check)

        // Normalize applicant info to match schema requirements
        const normalizedApplicantInfo = {
            name: applicantInfo?.name || `${(applicantInfo?.first_name || '').trim()} ${(applicantInfo?.last_name || '').trim()}`.trim(),
            email: applicantInfo?.email,
            phone: applicantInfo?.phone,
            college: applicantInfo?.college,
            course: applicantInfo?.course,
            year: applicantInfo?.year,
            prn: applicantInfo?.prn,
            gender: applicantInfo?.gender
        };

        // Create application
        const application = new RecruitmentApplication({
            recruitmentId,
            applicantInfo: normalizedApplicantInfo,
            answers
        });

        await application.save();

        // Update current applications count
        await Recruitment.findByIdAndUpdate(recruitmentId, {
            $inc: { currentApplications: 1 }
        });

        // Queue a confirmation email to the applicant (optional WhatsApp link)
        const whatsappLine = recruitment.whatsappGroupUrl ? `<p><a href="${recruitment.whatsappGroupUrl}">Join our WhatsApp group</a></p>` : '';
        await addRecruitmentEmailToQueue({
            email: normalizedApplicantInfo.email,
            name: normalizedApplicantInfo.name || `${formData?.applicantInfo?.first_name || ''} ${formData?.applicantInfo?.last_name || ''}`.trim(),
            subject: `Application Received: ${recruitment.title}`,
            html: `
                <p>Dear ${normalizedApplicantInfo.name || 'Applicant'},</p>
                <p>Thank you for applying to <strong>${recruitment.title}</strong>. We have received your recruitment application.</p>
                <br/>
                <b> <p> Join the Recruitment WhatsApp group for updates: ${whatsappLine}</p></b>
                <p>We will get back to you soon.<br/>MIT-WPU Science & Spirituality Forum</p>
            `
        });

        res.status(201).json({
            success: true,
            message: recruitment.successMessage,
            applicationId: application._id
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all recruitments (admin only)
const getAllRecruitments = async (req, res) => {
    try {
        const recruitments = await Recruitment.find()
            .select('-__v')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: recruitments
        });
    } catch (error) {
        console.error('Error fetching recruitments:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create recruitment (admin only)
const createRecruitment = async (req, res) => {
    try {
        const recruitmentData = req.body;

        // Deactivate all other recruitments if this one is active
        if (recruitmentData.isActive) {
            await Recruitment.updateMany({}, { isActive: false });
        }

        const recruitment = new Recruitment(recruitmentData);
        await recruitment.save();

        res.status(201).json({
            success: true,
            message: 'Recruitment created successfully',
            data: recruitment
        });
    } catch (error) {
        console.error('Error creating recruitment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update recruitment (admin only)
const updateRecruitment = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // If setting as active, deactivate others
        if (updateData.isActive) {
            await Recruitment.updateMany(
                { _id: { $ne: id } },
                { isActive: false }
            );
        }

        const recruitment = await Recruitment.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!recruitment) {
            return res.status(404).json({
                success: false,
                message: 'Recruitment not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Recruitment updated successfully',
            data: recruitment
        });
    } catch (error) {
        console.error('Error updating recruitment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete recruitment (admin only)
const deleteRecruitment = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if there are applications
        const applicationCount = await RecruitmentApplication.countDocuments({ recruitmentId: id });
        if (applicationCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete recruitment with existing applications'
            });
        }

        const recruitment = await Recruitment.findByIdAndDelete(id);
        if (!recruitment) {
            return res.status(404).json({
                success: false,
                message: 'Recruitment not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Recruitment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting recruitment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get applications for a recruitment (admin only)
const getApplications = async (req, res) => {
    try {
        const { recruitmentId } = req.params;
        const { status, page = 1, limit = 10, search, questionIndex, answerValue } = req.query;

        const filter = { recruitmentId };
        if (status) {
            filter.status = status;
        }

        // Add search filter for name or PRN
        if (search) {
            filter.$or = [
                { 'applicantInfo.name': { $regex: search, $options: 'i' } },
                { 'applicantInfo.prn': { $regex: search, $options: 'i' } }
            ];
        }

        // Add filter for choice-based question answer
        if (questionIndex !== undefined && answerValue !== undefined && questionIndex !== '' && answerValue !== '') {
            const questionIdx = parseInt(questionIndex);
            // Filter applications where the answer array contains an answer matching the question index and value
            filter['answers'] = {
                $elemMatch: {
                    questionIndex: questionIdx,
                    $or: [
                        { answer: answerValue }, // For single value answers (radio, dropdown)
                        { answer: { $in: [answerValue] } } // For array answers (checkbox)
                    ]
                }
            };
        }

        const applications = await RecruitmentApplication.find(filter)
            .populate('recruitmentId', 'title')
            .sort({ submittedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await RecruitmentApplication.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: {
                applications,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update application status (admin only)
const updateApplicationStatus = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, adminNotes } = req.body;

        const application = await RecruitmentApplication.findByIdAndUpdate(
            applicationId,
            {
                status,
                adminNotes,
                reviewedAt: new Date(),
                reviewedBy: req.userId
            },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Application status updated successfully',
            data: application
        });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Export applications as CSV (admin only)
const exportApplicationsCSV = async (req, res) => {
    try {
        const { recruitmentId } = req.params;

        // Fetch the recruitment to get question labels
        const recruitment = await Recruitment.findById(recruitmentId).select('title customQuestions');
        if (!recruitment) {
            return res.status(404).json({ success: false, message: 'Recruitment not found' });
        }

        // Fetch ALL applications (no pagination for export)
        const applications = await RecruitmentApplication.find({ recruitmentId })
            .sort({ submittedAt: -1 });

        // Helper: escape a value for CSV (wrap in quotes, escape inner quotes)
        const csvCell = (val) => {
            if (val === null || val === undefined) return '';
            const str = Array.isArray(val) ? val.join('; ') : String(val);
            // Wrap in quotes and escape any existing quotes
            return `"${str.replace(/"/g, '""')}"`;
        };

        // Fixed info columns
        const infoHeaders = ['#', 'Submitted At', 'Status', 'Name', 'Email', 'Phone', 'PRN', 'Gender', 'Year', 'Course', 'Admin Notes'];

        // Dynamic question columns from the recruitment definition
        const questionHeaders = recruitment.customQuestions.map((q, i) => `Q${i + 1}: ${q.question}`);

        const allHeaders = [...infoHeaders, ...questionHeaders];

        // Build CSV rows
        const rows = applications.map((app, idx) => {
            const info = app.applicantInfo || {};

            // Build a lookup from questionIndex → answer for this application
            const answerMap = {};
            (app.answers || []).forEach(a => {
                answerMap[a.questionIndex] = a.answer;
            });

            const infoValues = [
                idx + 1,
                app.submittedAt ? new Date(app.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
                app.status || '',
                info.name || `${info.first_name || ''} ${info.last_name || ''}`.trim(),
                info.email || '',
                info.phone || '',
                info.prn || '',
                info.gender || '',
                info.year || '',
                info.course || '',
                app.adminNotes || ''
            ];

            const questionValues = recruitment.customQuestions.map((_, i) => answerMap[i] ?? '');

            return [...infoValues, ...questionValues].map(csvCell).join(',');
        });

        const csvContent = [allHeaders.map(csvCell).join(','), ...rows].join('\r\n');

        const filename = `${recruitment.title.replace(/[^a-z0-9]/gi, '_')}_applications_${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        // BOM for Excel to correctly detect UTF-8
        res.send('\uFEFF' + csvContent);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export default {
    getActiveRecruitment,
    submitApplication,
    getAllRecruitments,
    createRecruitment,
    updateRecruitment,
    deleteRecruitment,
    getApplications,
    updateApplicationStatus,
    exportApplicationsCSV
};
