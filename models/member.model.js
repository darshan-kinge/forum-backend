import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
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
        // unique: true
    },
    gender: {
        type: String,
        required: true,
        enum: ['male', 'female']
    },
    prn: {
        type: Number,
        required: true, 
        // unqiue: true
    },
    phone: {
        type: String,
        trim: true
    },
    course: {
        type: String,
        required: true,
    },
    year: {
        type: String,
        required: true
    },
    member_id: {
        type: String,
    },
},
{
    timestamps: true
});

// memberSchema.pre('save', async function(next) {
//     const member = this;
//     const existingPRN = await Member.findOne({ prn: member.prn });
//     const existingEmail = await Member.findOne({ email: member.email });
//     if (existingPRN) {
//         const error = new Error('PRN already exists');
//         error.statusCode = 400;
//         next(error);
//     }
//     if (existingEmail) {
//         const error = new Error('Email already exists');
//         error.statusCode = 400;
//         next(error);
//     }
//     next();
// });
// userSchema.methods.comparePassword = async function(password) {
//     try {
//         const isMatch = bcrypt.compare(password, this.password);
//         return isMatch;
//     } catch (error) {
//         console.error(error);
//     }
// }

// userSchema.methods.generateToken = async function() {
//     try {
//         const token = jwt.sign({
//             userId: this._id.toString(),
//             email: this.email,
//             role: this.role,
//         }, process.env.JWT_SECRET, 
//         {
//             expiresIn: '30d' 
//         });
        
//         return token;
//     } catch (error) {
//         console.log(error);
//     }
// }


const Member = mongoose.model('Member', memberSchema);

export default Member;