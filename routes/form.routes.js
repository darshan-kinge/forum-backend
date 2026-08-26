import express from 'express';
import multer from 'multer';
import formController from '../controllers/form.controller.js';
import authMiddleware from '../middlewares/auth-middleware.js';
import adminMiddleware from '../middlewares/admin-middleware.js';
import validate from '../middlewares/validate-middleware.js';
import formValidator from '../validators/form.validator.js';
import dbCheckMiddleware from '../middlewares/db-check-middleware.js';

const formRouter = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Public routes (no authentication required)
formRouter.route('/route/:customRoute').get(dbCheckMiddleware, formController.getFormByRoute);
formRouter.route('/submit').post(
    dbCheckMiddleware,
    validate(formValidator.formResponseSchema),
    formController.submitFormResponse
);

// Admin routes (authentication and admin role required)
formRouter.route('/admin/all').get(authMiddleware, adminMiddleware, formController.getAllForms);
formRouter.route('/admin/upload-header').post(authMiddleware, adminMiddleware, upload.single('headerImage'), formController.uploadHeaderImage);
formRouter.route('/admin/:id').get(authMiddleware, adminMiddleware, formController.getFormById);
formRouter.route('/admin/create').post(
    authMiddleware,
    adminMiddleware,
    validate(formValidator.formSchema),
    formController.createForm
);
formRouter.route('/admin/update/:id').put(
    authMiddleware,
    adminMiddleware,
    validate(formValidator.formSchema),
    formController.updateForm
);
formRouter.route('/admin/delete/:id').delete(authMiddleware, adminMiddleware, formController.deleteForm);
formRouter.route('/admin/duplicate/:id').post(authMiddleware, adminMiddleware, formController.duplicateForm);
formRouter.route('/admin/responses/:formId').get(authMiddleware, adminMiddleware, formController.getFormResponses);
formRouter.route('/admin/response/:responseId').get(authMiddleware, adminMiddleware, formController.getFormResponse);
formRouter.route('/admin/response/:responseId/status').put(authMiddleware, adminMiddleware, formController.updateResponseStatus);
formRouter.route('/admin/stats/:formId').get(authMiddleware, adminMiddleware, formController.getFormStats);

export default formRouter;
