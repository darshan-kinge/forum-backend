import mongoose from 'mongoose';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import Form from '../models/form.model.js';
import FormResponse from '../models/formResponse.model.js';

// Get form by custom route (public endpoint)
const getFormByRoute = async (req, res) => {
    try {
        const { customRoute } = req.params;
        
        const form = await Form.findOne({
            customRoute: customRoute.toLowerCase(),
            isActive: true
        })
            .select('-__v')
            .lean(); // Use lean() for plain objects; customQuestions and all schema fields are included by default

        console.log('Form fetched by route:', {
            customRoute,
            found: !!form,
            customQuestionsCount: form?.customQuestions?.length || 0,
            customQuestions: form?.customQuestions
        });

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or inactive'
            });
        }

        // Check if submission deadline has passed
        if (form.submissionDeadline) {
            const now = new Date();
            if (form.submissionDeadline < now) {
                return res.status(400).json({
                    success: false,
                    message: 'Form submission deadline has passed',
                    closedMessage: form.closedMessage
                });
            }
        }

        // Check if max submissions reached
        if (form.maxSubmissions && form.currentSubmissions >= form.maxSubmissions) {
            return res.status(400).json({
                success: false,
                message: 'Maximum submissions reached',
                closedMessage: form.closedMessage
            });
        }

        res.status(200).json({
            success: true,
            data: form
        });
    } catch (error) {
        console.error('Error fetching form by route:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Submit form response (public endpoint)
const submitFormResponse = async (req, res) => {
    try {
        const { formId, respondentInfo, answers } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Validate form exists and is active
        const form = await Form.findById(formId);
        if (!form || !form.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Form is not active'
            });
        }

        // Check deadline
        if (form.submissionDeadline) {
            const now = new Date();
            if (form.submissionDeadline < now) {
                return res.status(400).json({
                    success: false,
                    message: 'Form submission deadline has passed'
                });
            }
        }

        // Check max submissions
        if (form.maxSubmissions && form.currentSubmissions >= form.maxSubmissions) {
            return res.status(400).json({
                success: false,
                message: 'Maximum submissions reached'
            });
        }

        // Validate respondentInfo based on form.respondentFields
        const normalizedRespondentInfo = {};
        if (respondentInfo && typeof respondentInfo === 'object') {
            // Process each field defined in form.respondentFields
            if (form.respondentFields && form.respondentFields.length > 0) {
                for (const field of form.respondentFields) {
                    const value = respondentInfo[field.fieldName];
                    
                    // Check required fields
                    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
                        return res.status(400).json({
                            success: false,
                            message: `${field.label} is required`
                        });
                    }
                    
                    // Normalize and validate based on type
                    if (value !== undefined && value !== null && value !== '') {
                        let normalizedValue = value;
                        
                        if (typeof value === 'string') {
                            normalizedValue = value.trim();
                            
                            // Type-specific validation
                            if (field.type === 'email' && normalizedValue) {
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                if (!emailRegex.test(normalizedValue)) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `${field.label} must be a valid email address`
                                    });
                                }
                                normalizedValue = normalizedValue.toLowerCase();
                            } else if (field.type === 'number' && normalizedValue) {
                                const numValue = Number(normalizedValue);
                                if (isNaN(numValue)) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `${field.label} must be a valid number`
                                    });
                                }
                                normalizedValue = numValue;
                            }
                            
                            // Apply validation rules
                            if (field.validation) {
                                if (field.validation.minLength && normalizedValue.length < field.validation.minLength) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `${field.label} must be at least ${field.validation.minLength} characters`
                                    });
                                }
                                if (field.validation.maxLength && normalizedValue.length > field.validation.maxLength) {
                                    return res.status(400).json({
                                        success: false,
                                        message: `${field.label} must be at most ${field.validation.maxLength} characters`
                                    });
                                }
                                if (field.validation.pattern && normalizedValue) {
                                    const pattern = new RegExp(field.validation.pattern);
                                    if (!pattern.test(normalizedValue)) {
                                        return res.status(400).json({
                                            success: false,
                                            message: `${field.label} format is invalid`
                                        });
                                    }
                                }
                            }
                        }
                        
                        normalizedRespondentInfo[field.fieldName] = normalizedValue;
                    }
                }
            }
            
            // Also include any additional fields not defined in respondentFields
            // (for backward compatibility and flexibility)
            Object.keys(respondentInfo).forEach(key => {
                if (!normalizedRespondentInfo.hasOwnProperty(key) && respondentInfo[key] !== undefined && respondentInfo[key] !== null && respondentInfo[key] !== '') {
                    // Auto-normalize email fields
                    if (key.toLowerCase().includes('email') && typeof respondentInfo[key] === 'string') {
                        normalizedRespondentInfo[key] = respondentInfo[key].trim().toLowerCase();
                    } else if (typeof respondentInfo[key] === 'string') {
                        normalizedRespondentInfo[key] = respondentInfo[key].trim();
                    } else {
                        normalizedRespondentInfo[key] = respondentInfo[key];
                    }
                }
            });
        }

        // Check if multiple submissions are allowed (check by email if exists)
        if (!form.allowMultipleSubmissions) {
            const emailField = form.respondentFields?.find(f => f.type === 'email' || f.fieldName.toLowerCase().includes('email'));
            const emailFieldName = emailField?.fieldName || 'email';
            const emailValue = normalizedRespondentInfo[emailFieldName] || normalizedRespondentInfo.email;
            
            if (emailValue) {
                // Query for duplicate submissions using dot notation for nested objects
                const duplicateQuery = {
                    formId,
                    [`respondentInfo.${emailFieldName}`]: emailValue.toLowerCase()
                };
                
                const existingResponse = await FormResponse.findOne(duplicateQuery);
                
                if (existingResponse) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have already submitted this form'
                    });
                }
            }
        }

        // Backward compatibility: Validate collectEmail and collectName if respondentFields not defined
        if ((!form.respondentFields || form.respondentFields.length === 0) && form.collectEmail) {
            if (!normalizedRespondentInfo.email || !normalizedRespondentInfo.email.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required for this form'
                });
            }
        }

        if ((!form.respondentFields || form.respondentFields.length === 0) && form.collectName) {
            if (!normalizedRespondentInfo.name || !normalizedRespondentInfo.name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Name is required for this form'
                });
            }
        }

        // Create response with dynamic respondentInfo
        const response = new FormResponse({
            formId,
            respondentInfo: normalizedRespondentInfo,
            answers,
            ipAddress
        });

        await response.save();

        // Update current submissions count
        await Form.findByIdAndUpdate(formId, {
            $inc: { currentSubmissions: 1 }
        });

        res.status(201).json({
            success: true,
            message: form.successMessage || 'Thank you for your submission!',
            responseId: response._id
        });

    } catch (error) {
        console.error('Error submitting form response:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all forms (admin only)
const getAllForms = async (req, res) => {
    try {
        const forms = await Form.find()
            .select('-__v')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: forms
        });
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get form by ID (admin only)
const getFormById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const form = await Form.findById(id).select('-__v');
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found'
            });
        }

        res.status(200).json({
            success: true,
            data: form
        });
    } catch (error) {
        console.error('Error fetching form:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Create form (admin only)
const createForm = async (req, res) => {
    try {
        const formData = req.body;
        
        console.log('Creating form with data:', {
            title: formData.title,
            customRoute: formData.customRoute,
            customQuestionsCount: formData.customQuestions?.length || 0,
            customQuestions: formData.customQuestions
        });

        // Check if custom route already exists
        const existingForm = await Form.findOne({ customRoute: formData.customRoute.toLowerCase() });
        if (existingForm) {
            return res.status(400).json({
                success: false,
                message: 'A form with this custom route already exists'
            });
        }

        const form = new Form(formData);
        await form.save();
        
        console.log('Form saved. customQuestions:', form.customQuestions);

        res.status(201).json({
            success: true,
            message: 'Form created successfully',
            data: form
        });
    } catch (error) {
        console.error('Error creating form:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A form with this custom route already exists'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update form (admin only)
const updateForm = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // If custom route is being updated, check for conflicts
        if (updateData.customRoute) {
            const existingForm = await Form.findOne({ 
                customRoute: updateData.customRoute.toLowerCase(),
                _id: { $ne: id }
            });
            if (existingForm) {
                return res.status(400).json({
                    success: false,
                    message: 'A form with this custom route already exists'
                });
            }
        }

        console.log('Updating form:', {
            id,
            customQuestionsCount: updateData.customQuestions?.length || 0,
            customQuestions: updateData.customQuestions
        });
        
        const form = await Form.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found'
            });
        }
        
        console.log('Form updated. customQuestions:', form.customQuestions);

        res.status(200).json({
            success: true,
            message: 'Form updated successfully',
            data: form
        });
    } catch (error) {
        console.error('Error updating form:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A form with this custom route already exists'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete form (admin only)
const deleteForm = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if there are responses
        const responseCount = await FormResponse.countDocuments({ formId: id });
        if (responseCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete form with ${responseCount} existing response(s). Delete responses first or archive the form.`
            });
        }

        const form = await Form.findByIdAndDelete(id);
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Form deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting form:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get form responses (admin only)
const getFormResponses = async (req, res) => {
    try {
        const { formId } = req.params;
        const { status, page = 1, limit = 10, search, questionIndex, answerValue } = req.query;

        const filter = { formId };
        if (status) {
            filter.status = status;
        }

        // Add search filter - search across respondentInfo fields dynamically
        if (search) {
            const searchConditions = [];
            
            // Get form to know what respondentFields exist
            const form = await Form.findById(formId).select('respondentFields');
            
            if (form && form.respondentFields && form.respondentFields.length > 0) {
                // Search in defined respondentFields
                form.respondentFields.forEach(field => {
                    searchConditions.push({ 
                        [`respondentInfo.${field.fieldName}`]: { $regex: search, $options: 'i' } 
                    });
                });
            } else {
                // Fallback to common fields if respondentFields not defined
                const commonFields = ['name', 'email', 'phone', 'company', 'organization'];
                commonFields.forEach(field => {
                    searchConditions.push({ 
                        [`respondentInfo.${field}`]: { $regex: search, $options: 'i' } 
                    });
                });
            }
            
            // Also search in answers (question answers)
            searchConditions.push({ 
                'answers.answer': { $regex: search, $options: 'i' } 
            });
            
            if (searchConditions.length > 0) {
                filter.$or = searchConditions;
            }
        }

        // Add filter for choice-based question answer
        if (questionIndex !== undefined && answerValue !== undefined && questionIndex !== '' && answerValue !== '') {
            const questionIdx = parseInt(questionIndex);
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

        const responses = await FormResponse.find(filter)
            .populate('formId', 'title customRoute respondentFields')
            .populate('reviewedBy', 'first_name last_name email')
            .sort({ submittedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await FormResponse.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: {
                responses,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching form responses:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get single form response (admin only)
const getFormResponse = async (req, res) => {
    try {
        const { responseId } = req.params;

        const response = await FormResponse.findById(responseId)
            .populate('formId', 'title customRoute customQuestions respondentFields')
            .populate('reviewedBy', 'first_name last_name email');

        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found'
            });
        }

        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Error fetching form response:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update response status (admin only)
const updateResponseStatus = async (req, res) => {
    try {
        const { responseId } = req.params;
        const { status, adminNotes } = req.body;

        const updateData = {
            status,
            adminNotes: adminNotes || '',
            reviewedAt: new Date(),
            reviewedBy: req.userId
        };

        const response = await FormResponse.findByIdAndUpdate(
            responseId,
            updateData,
            { new: true }
        ).populate('reviewedBy', 'first_name last_name email');

        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Response status updated successfully',
            data: response
        });
    } catch (error) {
        console.error('Error updating response status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get form statistics (admin only)
const getFormStats = async (req, res) => {
    try {
        const { formId } = req.params;

        const totalResponses = await FormResponse.countDocuments({ formId });
        const statusCounts = await FormResponse.aggregate([
            { $match: { formId: new mongoose.Types.ObjectId(formId) } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const statusMap = {
            submitted: 0,
            reviewed: 0,
            archived: 0
        };
        statusCounts.forEach(item => {
            statusMap[item._id] = item.count;
        });

        // Get responses per day for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyResponses = await FormResponse.aggregate([
            {
                $match: {
                    formId: new mongoose.Types.ObjectId(formId),
                    submittedAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalResponses,
                statusCounts: statusMap,
                dailyResponses
            }
        });
    } catch (error) {
        console.error('Error fetching form statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Upload header image (admin only) – returns URL for use in form
const uploadHeaderImage = async (req, res) => {
    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'forms/headers',
            resource_type: 'image'
        });
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });
        res.status(200).json({
            success: true,
            url: result.secure_url
        });
    } catch (error) {
        console.error('Error uploading header image:', error);
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({
            success: false,
            message: 'Failed to upload header image'
        });
    }
};

// Duplicate form (admin only)
const duplicateForm = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await Form.findById(id).lean();
        if (!original) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        // Strip Mongo fields
        const { _id, __v, createdAt, updatedAt, currentSubmissions, ...rest } = original;

        // Generate a unique custom route
        let baseRoute = `${rest.customRoute}-copy`;
        let candidateRoute = baseRoute;
        let counter = 1;
        while (await Form.findOne({ customRoute: candidateRoute })) {
            candidateRoute = `${baseRoute}-${counter++}`;
        }

        const duplicate = new Form({
            ...rest,
            title: `${rest.title} (Copy)`,
            customRoute: candidateRoute,
            isActive: false,       // start inactive so admin can review before publishing
            currentSubmissions: 0
        });

        // Strip _id from sub-document arrays (Mongoose assigns new ones automatically)
        if (Array.isArray(duplicate.customQuestions)) {
            duplicate.customQuestions = duplicate.customQuestions.map(q => {
                const { _id, ...q2 } = q;
                return q2;
            });
        }
        if (Array.isArray(duplicate.respondentFields)) {
            duplicate.respondentFields = duplicate.respondentFields.map(f => {
                const { _id, ...f2 } = f;
                return f2;
            });
        }

        await duplicate.save();

        res.status(201).json({
            success: true,
            message: 'Form duplicated successfully',
            data: duplicate
        });
    } catch (error) {
        console.error('Error duplicating form:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export default {
    getFormByRoute,
    submitFormResponse,
    getAllForms,
    getFormById,
    createForm,
    updateForm,
    deleteForm,
    getFormResponses,
    getFormResponse,
    updateResponseStatus,
    getFormStats,
    uploadHeaderImage,
    duplicateForm
};
