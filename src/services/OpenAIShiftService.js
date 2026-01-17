import { getRegistrations, updateRegistration } from '../firebaseService';

class OpenAIShiftService {
  constructor() {
    this.apiKey = process.env.REACT_APP_OPENAI_KEY;
    this.baseURL = 'https://api.openai.com/v1/chat/completions';
  }

  async aiAllocateShifts(options = {}) {
    try {
      const registrations = await getRegistrations();
      
      if (registrations.length === 0) {
        return { success: true, message: 'Không có đăng ký nào để phân bổ' };
      }

      // Chuẩn bị data cho OpenAI
      const prompt = this.buildPrompt(registrations, options);
      
      // Gọi OpenAI API
      const aiResponse = await this.callOpenAI(prompt);
      
      // Xử lý response
      const allocation = this.parseAIResponse(aiResponse, registrations);
      
      // Cập nhật Firebase
      await this.updateRegistrations(allocation);

      return {
        success: true,
        message: `Đã phân bổ AI thành công ${allocation.length} nhân viên`,
        allocation,
        aiInsights: this.extractInsights(aiResponse)
      };

    } catch (error) {
      console.error('Error in OpenAI allocation:', error);
      return { success: false, error: error.message };
    }
  }

  buildPrompt(registrations, options) {
    const employeeData = registrations.map(reg => ({
      name: reg.employeeName,
      shifts: reg.shifts,
      preferences: reg.preferences || [],
      performance: reg.performance || 0.8
    }));

    return `Bạn là chuyên gia phân bổ ca làm việc. Hãy phân bổ ca tối ưu cho các nhân viên sau:

${JSON.stringify(employeeData, null, 2)}

Yêu cầu:
1. Công bằng: mỗi nhân viên có số ca tương đối bằng nhau
2. Hiệu quả: ưu tiên nhân viên có performance cao
3. Sở thích: ưu tiên theo preferences nếu có
4. Giới hạn: tối đa 5 ca/tuần cho mỗi nhân viên

Trả về JSON format: {
  "allocations": [
    {"employeeName": "Tên", "shifts": [{"date": "2024-01-01", "shift": "A"}]}
  ],
  "reasoning": "Lý do phân bổ",
  "metrics": {"fairness": 0.9, "efficiency": 0.85}
}`;
  }

  async callOpenAI(prompt) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Bạn là chuyên gia phân bổ ca làm việc thông minh.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  parseAIResponse(aiResponse, originalRegistrations) {
    try {
      const parsed = JSON.parse(aiResponse);
      return parsed.allocations.map(allocation => {
        const originalReg = originalRegistrations.find(reg => reg.employeeName === allocation.employeeName);
        return {
          ...originalReg,
          shifts: allocation.shifts,
          allocated: true,
          allocatedAt: new Date().toISOString(),
          aiOptimized: true
        };
      });
    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error('AI response format invalid');
    }
  }

  extractInsights(aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse);
      return {
        reasoning: parsed.reasoning,
        metrics: parsed.metrics
      };
    } catch (error) {
      return { reasoning: 'Không thể phân tích insights', metrics: {} };
    }
  }

  async updateRegistrations(registrations) {
    const updatePromises = registrations.map(reg => 
      updateRegistration(reg.id, {
        shifts: reg.shifts,
        allocated: reg.allocated,
        allocatedAt: reg.allocatedAt,
        aiOptimized: reg.aiOptimized
      })
    );
    
    await Promise.all(updatePromises);
  }
}

export default new OpenAIShiftService();