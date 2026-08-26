import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    permissions: {
        type: Object,
        default: {},
        // Structure: { pageName: { view: Boolean, edit: Boolean } }
        // Example: { members: { view: true, edit: false }, blog: { view: true, edit: true } }
    }
});

userSchema.methods.comparePassword = async function(password) {
    try {
        const isMatch = bcrypt.compare(password, this.password);
        return isMatch;
    } catch (error) {
        console.error(error);
    }
}

userSchema.methods.generateToken = async function() {
    try {
        const token = jwt.sign({
            userId: this._id.toString(),
            email: this.email,
            isAdmin: this.isAdmin,
        }, process.env.JWT_SECRET, 
        {
            expiresIn: '30d' 
        });
        
        return token;
    } catch (error) {
        console.log(error);
    }
}

const User = mongoose.model('User', userSchema);

export default User;