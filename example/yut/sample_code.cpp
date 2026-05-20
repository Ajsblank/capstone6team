#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <cmath>

using namespace std;

class YutnoriBot {
public:
    int my_skills[2], opp_skills[2];
    bool my_skill_left[2], opp_skill_left[2];
    int my_pos[4], opp_pos[4];
    int bomb_pos;

    int my_time, opp_time;
    bool can_roll, rolled_this_turn, skill_used_this_turn;
    vector<int> yut_pool;
    
    bool double_buff_active = false;
    bool takeout_active = false;
    bool backstep_active = false;

    YutnoriBot() {
        for(int i=0; i<4; i++) { my_pos[i] = -1; opp_pos[i] = -1; }
        my_skill_left[0] = my_skill_left[1] = true;
        opp_skill_left[0] = opp_skill_left[1] = true;
        bomb_pos = 0;
    }

    void parse_init(const string& line) {
        stringstream ss(line); string cmd;
        ss >> cmd >> my_skills[0] >> my_skills[1] >> opp_skills[0] >> opp_skills[1];
    }

    void parse_time(const string& line) {
        stringstream ss(line); string cmd;
        ss >> cmd >> my_time >> opp_time >> can_roll >> rolled_this_turn >> skill_used_this_turn
           >> my_skill_left[0] >> my_skill_left[1] >> opp_skill_left[0] >> opp_skill_left[1] >> bomb_pos;
        for (int i = 0; i < 4; i++) ss >> my_pos[i];
        for (int i = 0; i < 4; i++) ss >> opp_pos[i];
        
        int y_cnt; ss >> y_cnt;
        yut_pool.clear();
        for (int i = 0; i < y_cnt; i++) {
            int y; ss >> y; yut_pool.push_back(y);
        }
    }

    void parse_opp_logs(const string& line) {
        stringstream ss(line); string cmd; int count;
        ss >> cmd >> count;
        for (int i = 0; i < count; i++) {
            string log_line;
            getline(cin, log_line);
        }
    }

    // ==========================================================
    // 메인 턴 진행 로직
    // ==========================================================
    void play_turn() {
        while (true) {
            // [행동 1] 스킬 사용
            if (can_roll && !rolled_this_turn && !skill_used_this_turn) {
                if (my_skill_left[0]) {
                    use_skill(my_skills[0], 0, 0); 
                    continue;
                }
            }

            // [행동 2] 윷 던지기
            if (can_roll) {
                roll_yut();
                continue; 
            }

            // [행동 3] 말 이동
            if (!yut_pool.empty()) {
                int yut = yut_pool.back();
                yut_pool.pop_back();

                int target_pid = find_best_piece_to_move(yut);
                if (target_pid != -1) {
                    move_piece(target_pid, yut);
                    continue; 
                } else {
                    continue; // 빽도 불가 등으로 버림
                }
            }

            pass_turn();
            break;
        }
    }

private:
    int find_best_piece_to_move(int yut_val) {
        int target_pid = -1;
        if (yut_val < 0) {
            for (int i = 0; i < 4; i++) {
                if (my_pos[i] > 0) { target_pid = i; break; }
            }
        } else {
            for (int i = 0; i < 4; i++) {
                if (my_pos[i] != 0) { target_pid = i; break; }
            }
        }
        return target_pid;
    }

    // ==========================================================
    // 내부 통신 및 상태 동기화 엔진
    // ==========================================================
    void use_skill(int skill_id, int param1, int param2) {
        cout << "SKILL " << skill_id;
        if (skill_id >= 9) cout << " " << param1 << " " << param2;
        cout << "\n" << flush;
        
        if (skill_id == my_skills[0]) my_skill_left[0] = false; else my_skill_left[1] = false;
        skill_used_this_turn = true;

        string r_line; getline(cin, r_line);
        stringstream r_ss(r_line); string dummy, type;
        r_ss >> dummy >> type; 
        
        if (type == "YUT") {
            int cnt; r_ss >> cnt;
            for(int i=0; i<cnt; i++) {
                int y; r_ss >> y; yut_pool.push_back(y);
                if (y >= 4) can_roll = true;
            }
        } else if (type == "BOARD") {
            for(int i=0; i<4; i++) r_ss >> my_pos[i];
            for(int i=0; i<4; i++) r_ss >> opp_pos[i];
        } else if (type == "OK") {
            if (skill_id == 4) double_buff_active = true;
            else if (skill_id == 7) takeout_active = true;
            else if (skill_id == 8) backstep_active = true;
            // 2, 3, 5, 6 스킬은 서버에서 알아서 확률을 조작해주므로 봇에서는 별도 플래그가 필요 없음
        }
    }

    void roll_yut() {
        cout << "ROLL\n" << flush;
        string r_line; getline(cin, r_line); 
        stringstream r_ss(r_line); string dummy; int yut_val;
        r_ss >> dummy >> yut_val;
        
        can_roll = (yut_val >= 4); 
        rolled_this_turn = true;

        if (takeout_active) {
            takeout_active = false;
        } else if (backstep_active) {
            yut_pool.push_back(-abs(yut_val));
            backstep_active = false;
        } else if (double_buff_active) {
            yut_pool.push_back(yut_val);
            yut_pool.push_back(yut_val);
            double_buff_active = false;
        } else {
            yut_pool.push_back(yut_val);
        }
    }

    void move_piece(int pid, int yut_val) {
        cout << "MOVE " << pid << " " << yut_val << "\n" << flush;
        string r_line; getline(cin, r_line);
        stringstream r_ss(r_line); string dummy; int caught;
        r_ss >> dummy >> caught;
        for(int i=0; i<4; i++) r_ss >> my_pos[i];
        for(int i=0; i<4; i++) r_ss >> opp_pos[i];
        if (caught) can_roll = true;
    }

    void pass_turn() {
        cout << "PASS\n" << flush;
    }
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    YutnoriBot bot;
    string line;

    while (getline(cin, line)) {
        if (line.empty()) continue;
        stringstream ss(line); string cmd; ss >> cmd;

        if (cmd == "READY") { cout << "OK\n" << flush; } 
        else if (cmd == "INIT") { bot.parse_init(line); } 
        else if (cmd == "TIME") {
            bot.parse_time(line);
            bot.play_turn();
        }
        else if (cmd == "OPP") { bot.parse_opp_logs(line); }
        else if (cmd == "FINISH") { break; }
    }
    return 0;
}