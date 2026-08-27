import User from "../models/user.model.js";
import bcrypt from 'bcryptjs';

const home = async (req, res) => {
    try {
        res.status(200).send('Hello World');
    } catch (error) {
        console.log(error);
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const userExists = await User.findOne({ email });

        if (!userExists) {
            return res.status(400).json({ details: 'User does not exist' });
        }

        const passwordMatch = await userExists.comparePassword(password)

        if (!passwordMatch) {
            return res.status(400).json({ details: 'Invalid email or password' });
        }

        return res.status(200).json({ 
            message: 'Login Successful!', 
            token: userExists.generateToken(),
            userId: userExists._id.toString(),
        });        

    } catch (error) {
        return res.status(500).json({ message: 'Internal server error'});
    } 
}


const register = async(req, res) => {
    try {
        const { first_name, last_name, email, password } = req.body;
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ details: 'User already exists' });
        }

        // const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const data = await User.create({ 
            first_name,
            last_name, 
            email, 
            password: hashedPassword,
        });



        const token = await data.generateToken();
        
        // const token = jwt.sign({ userId: data._id.toString(),
        //     email: data.email,
        //     isAdmin: data.isAdmin,
        // }, process.env.JWT_SECRET, 
        // {
        //     expiresIn: '30d'  
        // });

        res.status(200).json({ 
            message: "Registration Successfull...", 
            token,
            userId: data._id.toString(),
        });
    } catch (error) {   
        console.log(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const user = async(req, res) => {
    try {
        const userData = req.user;
        return res.status(200).json({userData});
        // console.log(userData);
    } catch (error) {
        console.log('Error from the user route');
    }
}


export default { 
    home,
    login,
    register,
    user
};