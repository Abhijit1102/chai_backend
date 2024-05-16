import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token");
    }
}


const registerUser = asyncHandler(async(req, res) => {
   
    const {fullName, email, username, password } = req.body
    console.log("email : ", email);
    if (
        [fullName, email, username, password].some((field) =>
        field?.trim()==="")
     ) {
        throw new ApiError(400, "All fields are required")
    }

    const exitedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (exitedUser) {
        throw new ApiError(409, "User with email or username exits")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required | Cloudinary")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username ? username.toLowerCase() : ""
    });
    

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user")
    }
    
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Register Successfully")
    )
})

const loginUser  =  asyncHandler(async(req, res) =>{
    const { email, username, password } = req.body
    console.log("email : ",  email);
    console.log("username : ", username);
    console.log("password : ", password);

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    const user =  await User.findOne({
        $or : [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exits")
    }
    
    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }
    
    const { accessToken,  refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken: 1 //undefined if set
            }
        },
        {
            new: true
        }
    )
    
    const options = {
        httpOnly: true,
        secure: true
    } 

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request: Refresh token not provided");
    }

    const decodingToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SCERET
    )   

    const user = await User.findById(decodingToken?._id)

    if (!user) {
        throw new ApiError(401,"Invalid refresh tooken")    
    }

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used")
    }

    try {
        const options ={
            httpOnly:true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} =
        await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                {accessToken, refreshToken : newRefreshToken},
                "Acces token refreshed"
            )
        )


    } catch(error) {
        throw new ApiError (401, error?.message ||
            "Invalid refresh token"
        )
    }
}
);

const changedCurrentPassword = asyncHandler(async(req, 
    res) => {
        const {oldPassword, newPassword} = req.body

        const user = await User.findById(req.user?._id)
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
        
        if (!isPasswordCorrect) {
            throw new ApiError(4000,"Invalid old password")
        }

        user.password = newPassword
        await user.save({validateBeforeSave: false})

        return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed Sucessfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, 
        req.user, 
        "current user fetched successfully"
        ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const { fullName, email} = req.body
    console.log(email)
    console.log(fullName)

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, 
        user, 
        "Acount details updated Successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file not provided");
    }
    const  avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        }
    )
    return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated Successfully"))
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath ) {
        throw new ApiError(400, "CoverImage file not provided");
    }
    const  coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")
    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated Successfully"))

});

const getUserChannelProfile = asyncHandler(async(req, 
    res) =>{
        const { username } = req.params 

        if (!username?.trim()) {
            throw new ApiError(400, "username is missing")
        }
         const channel = await User.aggregate([
            {
                $match:{
                    username : username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from : "Subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as : "subscribers"
                    }
            },
            {
                $lookup: {
                    from : "Subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as : "subscriberTo"
                    }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size : "$subscribers"
                    },
                    channelsSubscribedTocount:{
                        $size : "$subscribers"
                    },
                    isSubscribed: {
                        $cond : {
                            if : {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }

                    }
                }
            },
            {
                $project: {
                    fullname: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelsSubscribedTocount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
                }

            }
        ])
        if(!channel?.length) {
            throw new ApiError(404, "channel does not exists")
        }

        return res
        .status(200)
        .json(
            new ApiError(200, channel[0], "User channel fetched successfully")
        )
});

const getWatchHistory = asyncHandler(async(req, res) =>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },{
            $lookup: {
                from: "videos",
                localField: "watchedHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as : "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].getWatchHistory,
            "watch history fetched succesfully"
        )
    )
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changedCurrentPassword,
    getCurrentUser, 
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}