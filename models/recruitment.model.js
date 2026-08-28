import mongoose from 'mongoose';

const recruitmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    applicationDeadline: {
        type: Date,
        required: true
    },
    maxApplications: {
        type: Number,
        default: 100
    },
    currentApplications: {
        type: Number,
        default: 0
    },
    customQuestions: [{
        question: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['text', 'textarea', 'dropdown', 'radio', 'checkbox', 'email', 'number', 'date'],
            required: true
        },
        options: [String], // For dropdown, radio, checkbox
        required: {
            type: Boolean,
            default: false
        },
        allowMultiple: {
            type: Boolean,
            default: false
        },
        placeholder: String,
        validation: {
            minLength: Number,
            maxLength: Number,
            pattern: String
        },
        // Optional conditional visibility: show this question if another question matches a value
        showIf: {
            questionIndex: { type: Number },
            operator: { type: String, enum: ['equals'], default: 'equals' },
            value: { type: String }
        }
    }],
    successMessage: {
        type: String,
        default: 'Thank you for your application! We will get back to you soon.'
    },
    closedMessage: {
        type: String,
        default: 'Recruitment is currently closed. Please check back later.'
    },
    whatsappGroupUrl: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

const Recruitment = mongoose.model('Recruitment', recruitmentSchema);

export default Recruitment;
