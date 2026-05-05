-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3307
-- Generation Time: May 05, 2026 at 05:45 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lebconnect`
--

-- --------------------------------------------------------

--
-- Table structure for table `applications`
--

CREATE TABLE `applications` (
  `id` int(10) UNSIGNED NOT NULL,
  `candidate_id` int(10) UNSIGNED NOT NULL,
  `job_id` int(10) UNSIGNED NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `stage` varchar(50) NOT NULL DEFAULT 'applied',
  `viewed_at` datetime DEFAULT NULL,
  `interview_date` datetime DEFAULT NULL,
  `interview_location` text DEFAULT NULL,
  `interview_mode` varchar(50) DEFAULT NULL,
  `cv` longtext DEFAULT NULL,
  `cv_file_name` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `comments`
--

CREATE TABLE `comments` (
  `id` int(10) UNSIGNED NOT NULL,
  `post_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `text` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `comments`
--

INSERT INTO `comments` (`id`, `post_id`, `user_id`, `text`, `created_at`) VALUES
(80000, 50012, 22011, 'jd', '2026-05-05 14:58:34');

-- --------------------------------------------------------

--
-- Table structure for table `company_reviews`
--

CREATE TABLE `company_reviews` (
  `id` int(10) UNSIGNED NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `comment` text NOT NULL,
  `interview_experience` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `complaints`
--

CREATE TABLE `complaints` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `against_user_id` int(10) UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `status` enum('open','reviewing','resolved') NOT NULL DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `follows`
--

CREATE TABLE `follows` (
  `id` int(10) UNSIGNED NOT NULL,
  `follower_id` int(10) UNSIGNED NOT NULL,
  `following_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `follows`
--

INSERT INTO `follows` (`id`, `follower_id`, `following_id`, `created_at`) VALUES
(90001, 22011, 22006, '2026-05-05 14:58:42');

-- --------------------------------------------------------

--
-- Table structure for table `interviews`
--

CREATE TABLE `interviews` (
  `id` int(10) UNSIGNED NOT NULL,
  `application_id` int(10) UNSIGNED NOT NULL,
  `candidate_id` int(10) UNSIGNED NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `job_id` int(10) UNSIGNED NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `mode` enum('online','office') NOT NULL DEFAULT 'online',
  `location_or_link` text DEFAULT NULL,
  `message` text DEFAULT NULL,
  `status` enum('scheduled','cancelled','completed') NOT NULL DEFAULT 'scheduled',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` int(10) UNSIGNED NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `salary` varchar(255) DEFAULT NULL,
  `requirements` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`requirements`)),
  `status` enum('active','closed') NOT NULL DEFAULT 'active',
  `applicants_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `jobs`
--

INSERT INTO `jobs` (`id`, `company_id`, `title`, `description`, `location`, `type`, `salary`, `requirements`, `status`, `applicants_count`, `created_at`, `updated_at`) VALUES
(40000, 22001, 'Frontend Developer', 'Build responsive interfaces using React, JavaScript, HTML, CSS, and APIs.', 'Beirut', 'Full-time', '$900 - $1400', '[\"React\",\"JavaScript\",\"HTML\",\"CSS\",\"Git\",\"REST API\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40001, 22001, 'Backend Developer', 'Develop backend services and APIs for business applications.', 'Beirut', 'Hybrid', '$1000 - $1600', '[\"Node.js\",\"Express\",\"SQL\",\"MySQL\",\"REST API\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40002, 22002, 'Social Media Manager', 'Manage social media calendars and campaign performance.', 'Beirut', 'Full-time', '$700 - $1100', '[\"Social Media\",\"Content Writing\",\"Meta Ads\",\"Analytics\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40003, 22002, 'SEO Specialist', 'Improve search visibility and optimize content for campaigns.', 'Beirut', 'Part-time', '$500 - $850', '[\"SEO\",\"Content Writing\",\"Analytics\",\"Google Ads\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40004, 22003, 'Accountant', 'Handle accounting entries, payroll, and monthly financial reporting.', 'Tripoli', 'Full-time', '$700 - $1200', '[\"Accounting\",\"Excel\",\"Payroll\",\"Tax\",\"Reporting\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40005, 22003, 'Financial Analyst', 'Analyze financial data and prepare management reports.', 'Tripoli', 'Full-time', '$900 - $1400', '[\"Financial Analysis\",\"Excel\",\"Budgeting\",\"Reporting\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40006, 22004, 'Medical Secretary', 'Manage appointments, records, and patient communication.', 'Saida', 'Full-time', '$500 - $800', '[\"Medical Records\",\"Scheduling\",\"Communication\",\"Customer Service\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40007, 22004, 'Nurse Assistant', 'Support patient care and clinic records.', 'Saida', 'Full-time', '$600 - $1000', '[\"Patient Care\",\"Medical Records\",\"Communication\"]', 'active', 0, '2026-05-05 12:03:30', '2026-05-05 12:03:30'),
(40008, 22005, 'Site Supervisor', 'Supervise site progress, contractors, and safety standards.', 'Zahle', 'Full-time', '$900 - $1500', '[\"Site Supervision\",\"AutoCAD\",\"Project Management\"]', 'active', 0, '2026-05-05 12:03:31', '2026-05-05 12:03:31'),
(40009, 22005, 'Civil Engineer', 'Support construction planning and project supervision.', 'Zahle', 'Full-time', '$1000 - $1700', '[\"Civil Engineering\",\"AutoCAD\",\"Site Supervision\"]', 'active', 0, '2026-05-05 12:03:31', '2026-05-05 12:03:31');

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(10) UNSIGNED NOT NULL,
  `sender_id` int(10) UNSIGNED NOT NULL,
  `receiver_id` int(10) UNSIGNED NOT NULL,
  `text` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('application','message','system','post','follow','interview','job_alert','verification','report') NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at`) VALUES
(101000, 22007, 'New Like', 'abed saadi liked your post', 'post', 0, '2026-05-05 13:51:32'),
(101001, 22006, 'New Like', 'abed saadi liked your post', 'post', 0, '2026-05-05 13:57:47'),
(101002, 22005, 'New Follower', 'abed saadi started following you', 'follow', 0, '2026-05-05 14:07:31'),
(101003, 22006, 'New Like', 'abed saadi liked your post', 'post', 0, '2026-05-05 14:58:30'),
(101004, 22006, 'New Comment', 'abed saadi commented on your post', 'post', 0, '2026-05-05 14:58:34'),
(101005, 22006, 'New Follower', 'abed saadi started following you', 'follow', 0, '2026-05-05 14:58:42'),
(101006, 22012, 'New application', 'abed saadi applied for MIS', 'application', 1, '2026-05-05 15:07:47'),
(101007, 22011, 'Application update', 'Your application for \"MIS\" is now: Viewed.', 'application', 0, '2026-05-05 15:08:12'),
(101008, 22011, 'Application update', 'Your application for \"MIS\" is now: Shortlisted.', 'application', 0, '2026-05-05 15:08:14'),
(101009, 22011, 'Application rejected', 'Your application for \"MIS\" was rejected.', 'application', 0, '2026-05-05 15:21:48'),
(101010, 22012, 'New application', 'abed saadi applied for cs', 'application', 0, '2026-05-05 15:23:31');

-- --------------------------------------------------------

--
-- Table structure for table `posts`
--

CREATE TABLE `posts` (
  `id` int(10) UNSIGNED NOT NULL,
  `author_id` int(10) UNSIGNED NOT NULL,
  `content` text NOT NULL,
  `image` longtext DEFAULT NULL,
  `post_type` enum('standard','job') NOT NULL DEFAULT 'standard',
  `job_id` int(10) UNSIGNED DEFAULT NULL,
  `share_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `posts`
--

INSERT INTO `posts` (`id`, `author_id`, `content`, `image`, `post_type`, `job_id`, `share_count`, `created_at`, `updated_at`) VALUES
(50000, 22005, 'We are hiring: Civil Engineer in Zahle. Apply now on LebConnect!', '/demo-posts/hiring-team.jpg', 'job', 40009, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50001, 22005, 'We are hiring: Site Supervisor in Zahle. Apply now on LebConnect!', '/demo-posts/construction-site.jpg', 'job', 40008, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50002, 22004, 'We are hiring: Nurse Assistant in Saida. Apply now on LebConnect!', '/demo-posts/healthcare-team.jpg', 'job', 40007, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50003, 22004, 'We are hiring: Medical Secretary in Saida. Apply now on LebConnect!', '/demo-posts/hiring-team.jpg', 'job', 40006, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50004, 22003, 'We are hiring: Financial Analyst in Tripoli. Apply now on LebConnect!', '/demo-posts/finance-work.jpg', 'job', 40005, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50007, 22006, 'Excited to connect with Lebanese professionals and discover new opportunities on LebConnect.', '/demo-posts/hiring-team.jpg', 'standard', NULL, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50008, 22007, 'Tip: Keep your profile updated with skills, experience, and a clear CV to improve your job match score.', '/demo-posts/hiring-team.jpg', 'standard', NULL, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50009, 22008, 'I am looking for junior accounting opportunities in Tripoli or remote.', '/demo-posts/finance-work.jpg', 'standard', NULL, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50010, 22009, 'Healthcare work needs communication, patience, and attention to detail.', '/demo-posts/healthcare-team.jpg', 'standard', NULL, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50011, 22010, 'Sharing my latest AutoCAD training progress and looking for site supervision experience.', '/demo-posts/construction-site.jpg', 'standard', NULL, 0, '2026-05-05 12:03:31', '2026-05-05 12:06:45'),
(50012, 22006, 'Recently I have been focusing on improving my React skills and building cleaner user interfaces. Small daily progress is making a big difference in my work.', '/demo-posts/candidate-react.jpg', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:51:12'),
(50013, 22006, 'Recently I have been focusing on improving my React skills and building cleaner user interfaces. Small daily progress is making a big difference in my work.', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:53:47'),
(50014, 22007, 'I have been learning more about digital marketing strategy, especially content planning and audience engagement. Consistency really matters in this field.', '/demo-posts/candidate-marketing.jpg', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:51:12'),
(50015, 22007, 'I have been learning more about digital marketing strategy, especially content planning and audience engagement. Consistency really matters in this field.', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:53:47'),
(50016, 22008, 'Today I spent time reviewing financial reports and practicing Excel functions that help in accounting work. Strong fundamentals always help in real jobs.', '/demo-posts/candidate-finance.jpg', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:51:12'),
(50017, 22008, 'Today I spent time reviewing financial reports and practicing Excel functions that help in accounting work. Strong fundamentals always help in real jobs.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&auto=format&fit=crop', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:53:47'),
(50018, 22009, 'Working in healthcare taught me how important communication and patience are. Even small improvements in daily workflow can make patient support better.', '/demo-posts/candidate-healthcare.jpg', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:51:12'),
(50019, 22009, 'Working in healthcare taught me how important communication and patience are. Even small improvements in daily workflow can make patient support better.', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&auto=format&fit=crop', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:53:47'),
(50020, 22010, 'I am continuing to improve my AutoCAD and site coordination skills. Step by step, I feel more ready to work on real engineering and construction projects.', '/demo-posts/candidate-engineering.jpg', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:51:12'),
(50021, 22010, 'I am continuing to improve my AutoCAD and site coordination skills. Step by step, I feel more ready to work on real engineering and construction projects.', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&auto=format&fit=crop', 'standard', NULL, 0, '2026-05-05 13:51:12', '2026-05-05 13:53:47');

-- --------------------------------------------------------

--
-- Table structure for table `post_likes`
--

CREATE TABLE `post_likes` (
  `post_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `post_likes`
--

INSERT INTO `post_likes` (`post_id`, `user_id`, `created_at`) VALUES
(50012, 22011, '2026-05-05 14:58:29'),
(50013, 22011, '2026-05-05 13:57:47');

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `link` varchar(1024) DEFAULT NULL,
  `image` longtext DEFAULT NULL,
  `technologies` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reports`
--

CREATE TABLE `reports` (
  `id` int(10) UNSIGNED NOT NULL,
  `reporter_id` int(10) UNSIGNED NOT NULL,
  `target_type` enum('post','user','job','company') NOT NULL,
  `target_id` int(10) UNSIGNED NOT NULL,
  `reason` text NOT NULL,
  `status` enum('open','reviewing','resolved') NOT NULL DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `saved_jobs`
--

CREATE TABLE `saved_jobs` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `job_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `saved_jobs`
--

INSERT INTO `saved_jobs` (`user_id`, `job_id`, `created_at`) VALUES
(22011, 40008, '2026-05-05 14:59:52');

-- --------------------------------------------------------

--
-- Table structure for table `saved_searches`
--

CREATE TABLE `saved_searches` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `keyword` varchar(512) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `type` varchar(128) DEFAULT NULL,
  `field` varchar(255) DEFAULT NULL,
  `salary` varchar(255) DEFAULT NULL,
  `sort` varchar(64) DEFAULT NULL,
  `alert_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_reviews`
--

CREATE TABLE `site_reviews` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('candidate','company','admin') NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `specialization` varchar(255) DEFAULT NULL,
  `normalized_specialization` varchar(128) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `skills` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`skills`)),
  `education` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`education`)),
  `experience` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`experience`)),
  `candidate_cv` longtext DEFAULT NULL,
  `candidate_cv_file_name` varchar(255) DEFAULT NULL,
  `candidate_cv_text` longtext DEFAULT NULL,
  `profile_image` longtext DEFAULT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `industry` varchar(255) DEFAULT NULL,
  `normalized_industry` varchar(128) DEFAULT NULL,
  `company_size` varchar(100) DEFAULT NULL,
  `website` varchar(512) DEFAULT NULL,
  `logo` longtext DEFAULT NULL,
  `cover_image` longtext DEFAULT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cv_analysis` longtext DEFAULT NULL,
  `cv_analysis_updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `role`, `full_name`, `specialization`, `normalized_specialization`, `location`, `bio`, `skills`, `education`, `experience`, `candidate_cv`, `candidate_cv_file_name`, `candidate_cv_text`, `profile_image`, `company_name`, `industry`, `normalized_industry`, `company_size`, `website`, `logo`, `cover_image`, `is_verified`, `created_at`, `updated_at`, `cv_analysis`, `cv_analysis_updated_at`) VALUES
(22000, 'admin@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'admin', 'Platform Admin', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 10:14:20', '2026-05-05 10:14:20', NULL, NULL),
(22001, 'demo.company1@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'company', 'Cedars Tech HR', NULL, NULL, 'Beirut', 'A Lebanese technology company building modern web and business solutions.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Cedars Tech', 'Technology', 'technology', '11-50', 'https://cedarstech.example.com', NULL, NULL, 1, '2026-05-05 12:00:38', '2026-05-05 12:00:38', NULL, NULL),
(22002, 'demo.company2@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'company', 'Beirut Marketing Team', NULL, NULL, 'Beirut', 'A creative agency focused on branding, social media, and digital campaigns.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Beirut Marketing Hub', 'Marketing', 'marketing', '11-50', 'https://beirutmarketing.example.com', NULL, NULL, 1, '2026-05-05 12:00:38', '2026-05-05 12:00:38', NULL, NULL),
(22003, 'demo.company3@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'company', 'North Finance HR', NULL, NULL, 'Tripoli', 'A finance and accounting services company serving businesses across Lebanon.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'North Finance Group', 'Finance', 'finance', '51-200', 'https://northfinance.example.com', NULL, NULL, 0, '2026-05-05 12:00:38', '2026-05-05 12:00:38', NULL, NULL),
(22004, 'demo.company4@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'company', 'MedCare HR', NULL, NULL, 'Saida', 'A healthcare center providing patient care and administrative medical services.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'MedCare Clinic', 'Healthcare', 'healthcare', '51-200', 'https://medcare.example.com', NULL, NULL, 0, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22005, 'demo.company5@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'company', 'BuildPro HR', NULL, NULL, 'Zahle', 'An engineering and construction company working on residential and commercial projects.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BuildPro Engineering', 'Construction', 'construction', '11-50', 'https://buildpro.example.com', NULL, NULL, 1, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22006, 'demo.candidate1@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'candidate', 'Karim Haddad', 'Technology', 'technology', 'Beirut', 'Frontend developer interested in React and modern web applications.', '[\"React\",\"JavaScript\",\"HTML\",\"CSS\",\"Git\"]', '[\"BS Computer Science - Lebanese University\"]', '[\"Frontend internship building responsive websites\"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22007, 'demo.candidate2@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'candidate', 'Maya Nassar', 'Marketing', 'marketing', 'Beirut', 'Marketing candidate interested in social media and content campaigns.', '[\"Social Media\",\"Content Writing\",\"SEO\",\"Meta Ads\"]', '[\"BA Marketing - Beirut Arab University\"]', '[\"Managed social media pages for small businesses\"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22008, 'demo.candidate3@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'candidate', 'Ali Mansour', 'Finance', 'finance', 'Tripoli', 'Junior accountant with Excel and reporting skills.', '[\"Accounting\",\"Excel\",\"Payroll\",\"Reporting\"]', '[\"BS Accounting - Lebanese International University\"]', '[\"Prepared invoices and monthly financial reports\"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22009, 'demo.candidate4@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'candidate', 'Sara Khoury', 'Healthcare', 'healthcare', 'Saida', 'Healthcare assistant interested in patient care and clinic administration.', '[\"Patient Care\",\"Medical Records\",\"Communication\"]', '[\"Nursing Assistant Certificate\"]', '[\"Assisted with patient records and front desk scheduling\"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22010, 'demo.candidate5@lebconnect.com', '$2b$10$apZ6QN3Z3UCxu0ESykZsaOhcRSXzVgLL2keCTNk9l7JlaG2vLQi/i', 'candidate', 'Nour Farhat', 'Construction', 'construction', 'Zahle', 'Civil engineering student interested in site supervision and AutoCAD.', '[\"AutoCAD\",\"Site Supervision\",\"Project Management\"]', '[\"BS Civil Engineering - Lebanese University\"]', '[\"Training on construction site documentation\"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 12:00:39', '2026-05-05 12:00:39', NULL, NULL),
(22011, 'abedsaadi4@gmail.com', '$2b$10$8oyBFlakVy5rdILp0LvKGOB3maeb5519S2jLxKbOnNJAAowCYmYwe', 'candidate', 'abed saadi', 'Technology', 'technology', 'w21', 'wqeqeweqwew', '[\"wqe\"]', '[\"ewqe\"]', '[\"wqeqwe\"]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-05-05 12:04:52', '2026-05-05 14:06:48', NULL, NULL),
(22012, 'abedsaadi1@gmail.com', '$2b$10$xONYDZoij3B5W6W6L.iG0O0VF45TkcxWNEMIFfrNSXGr.P3LmERj2', 'company', NULL, NULL, NULL, 'akkar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Abed saadi', 'Technology', 'technology', NULL, NULL, NULL, NULL, 0, '2026-05-05 15:05:29', '2026-05-05 15:05:29', NULL, NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `applications`
--
ALTER TABLE `applications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_application_candidate_job` (`candidate_id`,`job_id`),
  ADD KEY `idx_app_job` (`job_id`),
  ADD KEY `idx_app_company` (`company_id`);

--
-- Indexes for table `comments`
--
ALTER TABLE `comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_comments_post` (`post_id`),
  ADD KEY `fk_comments_user` (`user_id`);

--
-- Indexes for table `company_reviews`
--
ALTER TABLE `company_reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_crev_company_user` (`company_id`,`user_id`),
  ADD KEY `idx_crev_company` (`company_id`),
  ADD KEY `idx_crev_user` (`user_id`);

--
-- Indexes for table `complaints`
--
ALTER TABLE `complaints`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_complaints_user` (`user_id`),
  ADD KEY `idx_complaints_against` (`against_user_id`);

--
-- Indexes for table `follows`
--
ALTER TABLE `follows`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_follows_pair` (`follower_id`,`following_id`),
  ADD KEY `idx_follows_follower` (`follower_id`),
  ADD KEY `idx_follows_following` (`following_id`);

--
-- Indexes for table `interviews`
--
ALTER TABLE `interviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_interviews_app` (`application_id`),
  ADD KEY `idx_interviews_cand` (`candidate_id`),
  ADD KEY `idx_interviews_co` (`company_id`),
  ADD KEY `fk_interviews_job` (`job_id`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_jobs_company` (`company_id`),
  ADD KEY `idx_jobs_status` (`status`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_msg_sender` (`sender_id`),
  ADD KEY `idx_msg_receiver` (`receiver_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_user` (`user_id`);

--
-- Indexes for table `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_posts_author` (`author_id`),
  ADD KEY `fk_posts_job` (`job_id`);

--
-- Indexes for table `post_likes`
--
ALTER TABLE `post_likes`
  ADD PRIMARY KEY (`post_id`,`user_id`),
  ADD KEY `idx_pl_user` (`user_id`);

--
-- Indexes for table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_projects_user` (`user_id`);

--
-- Indexes for table `reports`
--
ALTER TABLE `reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reports_status` (`status`),
  ADD KEY `fk_reports_reporter` (`reporter_id`);

--
-- Indexes for table `saved_jobs`
--
ALTER TABLE `saved_jobs`
  ADD PRIMARY KEY (`user_id`,`job_id`),
  ADD KEY `fk_saved_job` (`job_id`);

--
-- Indexes for table `saved_searches`
--
ALTER TABLE `saved_searches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ss_user` (`user_id`);

--
-- Indexes for table `site_reviews`
--
ALTER TABLE `site_reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_site_reviews_created_at` (`created_at`),
  ADD KEY `fk_site_reviews_user` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `applications`
--
ALTER TABLE `applications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60002;

--
-- AUTO_INCREMENT for table `comments`
--
ALTER TABLE `comments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=80001;

--
-- AUTO_INCREMENT for table `company_reviews`
--
ALTER TABLE `company_reviews`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=130031;

--
-- AUTO_INCREMENT for table `complaints`
--
ALTER TABLE `complaints`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=160020;

--
-- AUTO_INCREMENT for table `follows`
--
ALTER TABLE `follows`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=90002;

--
-- AUTO_INCREMENT for table `interviews`
--
ALTER TABLE `interviews`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=70000;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40012;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100000;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=101011;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=50026;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=110031;

--
-- AUTO_INCREMENT for table `reports`
--
ALTER TABLE `reports`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=150026;

--
-- AUTO_INCREMENT for table `saved_searches`
--
ALTER TABLE `saved_searches`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=120026;

--
-- AUTO_INCREMENT for table `site_reviews`
--
ALTER TABLE `site_reviews`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=140031;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22013;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `applications`
--
ALTER TABLE `applications`
  ADD CONSTRAINT `fk_app_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_app_company` FOREIGN KEY (`company_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_app_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `comments`
--
ALTER TABLE `comments`
  ADD CONSTRAINT `fk_comments_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `company_reviews`
--
ALTER TABLE `company_reviews`
  ADD CONSTRAINT `fk_crev_company` FOREIGN KEY (`company_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_crev_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `complaints`
--
ALTER TABLE `complaints`
  ADD CONSTRAINT `fk_complaints_against` FOREIGN KEY (`against_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_complaints_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `follows`
--
ALTER TABLE `follows`
  ADD CONSTRAINT `fk_follows_follower` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_follows_following` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `interviews`
--
ALTER TABLE `interviews`
  ADD CONSTRAINT `fk_interviews_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_interviews_cand` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_interviews_co` FOREIGN KEY (`company_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_interviews_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `jobs`
--
ALTER TABLE `jobs`
  ADD CONSTRAINT `fk_jobs_company` FOREIGN KEY (`company_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_msg_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_msg_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `posts`
--
ALTER TABLE `posts`
  ADD CONSTRAINT `fk_posts_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_posts_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `post_likes`
--
ALTER TABLE `post_likes`
  ADD CONSTRAINT `fk_pl_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `fk_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reports`
--
ALTER TABLE `reports`
  ADD CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `saved_jobs`
--
ALTER TABLE `saved_jobs`
  ADD CONSTRAINT `fk_saved_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_saved_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `saved_searches`
--
ALTER TABLE `saved_searches`
  ADD CONSTRAINT `fk_ss_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `site_reviews`
--
ALTER TABLE `site_reviews`
  ADD CONSTRAINT `fk_site_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
