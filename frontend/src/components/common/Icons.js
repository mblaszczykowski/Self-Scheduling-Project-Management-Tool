import React from 'react';
import { HiOutlineChevronUp, HiOutlineChevronDown, HiOutlinePlus, HiStar } from 'react-icons/hi';

export const CollapseIcon = ({ className = "h-4 w-4" }) => (
    <HiOutlineChevronUp className={className} />
);

export const ExpandIcon = ({ className = "h-4 w-4" }) => (
    <HiOutlineChevronDown className={className} />
);

export const AddIcon = ({ className = "h-5 w-5" }) => (
    <HiOutlinePlus className={className} />
);

// Star icon remains solid (filled) as it's used for favorites/ratings
export const StarIcon = ({ className = "h-3.5 w-3.5", ...props }) => (
    <HiStar className={className} {...props} />
);
