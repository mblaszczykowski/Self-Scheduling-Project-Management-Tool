import React, {useState} from "react";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import {useNavigate} from "react-router-dom";
import {CheckIcon, StarIcon} from "./Icons";

export default function WelcomeContent({ show }) {
    const [showForm, setShowForm] = useState(show);
    const navigate = useNavigate();

    const handleResetForm = () => {
        navigate('/reset-password');
    };

    const handleToggleForm = () => {
        setShowForm((prev) => (prev === "login" ? "register" : "login"));
    };

    return (
        <React.Fragment>
            <div className="min-h-screen flex flex-col justify-between">
                <div className="flex-grow flex items-center justify-center">
                    <div className="relative flex items-center justify-center ">
                        <div className="backdrop-blur-xl rounded-3xl shadow-sm bg-white bg-opacity-80 overflow-hidden w-full max-w-5xl p-10">
                            <div className="flex flex-col md:flex-row w-full">
                                <div className="flex flex-col justify-center md:w-1/2 p-10 bg-gradient-to-b from-white via-blue-50 to-blue-100 rounded-l-3xl">
                                    <h1 className="pb-2 block font-semibold text-transparent bg-clip-text bg-gradient-to-l from-blue-700 to-blue-500 text-3xl md:text-5xl lg:text-4xl">
                                        Flowlink
                                    </h1>
                                    <div className="pt-6">
                                        <ul className="space-y-2 sm:space-y-4">
                                            <li className="flex space-x-3">
                                                <span
                                                    className="mt-0.5 size-5 flex justify-center items-center rounded-full bg-blue-50 text-blue-600">
                                                    <CheckIcon className="flex-shrink-0 size-3.5"/>
                                                </span>
                                                <span className="text-sm sm:text-base text-gray-500">
                                                    Effortlessly <span className="font-bold">Plan and Manage</span> Interdependent Projects
                                                </span>
                                            </li>
                                            <li className="flex space-x-3">
                                                <span
                                                    className="mt-0.5 size-5 flex justify-center items-center rounded-full bg-blue-50 text-blue-600">
                                                    <CheckIcon className="flex-shrink-0 size-3.5"/>
                                                </span>
                                                <span className="text-sm sm:text-base text-gray-500">
                                                    Track
                                                    <span className="font-bold"> Critical Paths </span>
                                                    with Precision and Clarity
                                                </span>
                                            </li>
                                            <li className="flex space-x-3">
                                                <span
                                                    className="mt-0.5 size-5 flex justify-center items-center rounded-full bg-blue-50 text-blue-600">
                                                    <CheckIcon className="flex-shrink-0 size-3.5"/>
                                                </span>
                                                <span className="text-sm sm:text-base text-gray-500">
                                                    Intuitive <span className="font-bold"> Gantt Charts </span> for Streamlined Planning
                                                </span>
                                            </li>
                                            <li className="flex space-x-3">
                                                <span
                                                    className="mt-0.5 size-5 flex justify-center items-center rounded-full bg-blue-50 text-blue-600">
                                                    <CheckIcon className="flex-shrink-0 size-3.5"/>
                                                </span>
                                                <span className="text-sm sm:text-base text-gray-500">
                                                    Enhance <span className="font-bold"> Collaboration </span> with Integrated Tools
                                                </span>
                                            </li>
                                            <li className="flex space-x-3">
                                                <span
                                                    className="mt-0.5 size-5 flex justify-center items-center rounded-full bg-blue-50 text-blue-600">
                                                    <CheckIcon className="flex-shrink-0 size-3.5"/>
                                                </span>
                                                <span className="text-sm sm:text-base text-gray-500">
                                                    <span className="font-bold">Real-Time Visualization </span> of Dependencies and Progress
                                                </span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="mt-8 flex items-center gap-x-5">
                                        <div className="flex -space-x-2">
                                            <span
                                                className="inline-flex justify-center items-center h-8 w-8 rounded-full bg-blue-600 text-white ring-2 ring-white">
                                                <StarIcon className="h-3.5 w-3.5"/>
                                            </span>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            Rated best by over 500 reviews
                                        </span>
                                    </div>
                                </div>
                                <div className="md:w-1/2 p-8 bg-white bg-opacity-90 rounded-r-3xl">
                                    <div className="mt-6">
                                        <div className="p-4 mt-6 sm:p-7 flex flex-col bg-white">
                                            {showForm !== "login" ? (
                                                <RegisterForm onToggleForm={handleToggleForm} />
                                            ) : (
                                                <LoginForm
                                                    onToggleForm={handleToggleForm}
                                                    onResetForm={handleResetForm}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
};
