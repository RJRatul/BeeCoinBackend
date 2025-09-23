"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const deposits_1 = __importDefault(require("./routes/deposits"));
const balance_1 = __importDefault(require("./routes/balance"));
const pairs_1 = __importDefault(require("./routes/pairs"));
const user_1 = __importDefault(require("./routes/user"));
const profitRules_1 = __importDefault(require("./routes/profitRules"));
const cronSettings_1 = __importDefault(require("./routes/cronSettings"));
const adminUsers_1 = __importDefault(require("./routes/adminUsers"));
const cronService_1 = require("./services/cronService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/deposits', deposits_1.default);
app.use('/api/balance', balance_1.default);
app.use('/api/pairs', pairs_1.default);
app.use('/api/user', user_1.default);
app.use('/api/profit-rules', profitRules_1.default);
app.use('/api/cron-settings', cronSettings_1.default);
app.use('/api/admin/users', adminUsers_1.default);
// MongoDB connection
mongoose_1.default.connect(process.env.MONGODB_URI)
    .then(() => {
    console.log('MongoDB connected');
    // Initialize cron jobs after successful DB connection
    cronService_1.cronService.initScheduledJobs();
    // Start the server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})
    .catch(err => console.log('MongoDB connection error:', err));
