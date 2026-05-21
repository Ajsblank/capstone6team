#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <cmath>
#include <algorithm>

using namespace std;

class YutnoriBot {
public:
    int my_skills[2], opp_skills[2];
    bool my_skill_left[2], opp_skill_left[2];
    int my_pos[4], opp_pos[4];
    int bomb_pos, teleport_pos;

    int my_time, opp_time;
    bool can_roll, rolled_this_turn, skill_used_this_turn;
    vector<int> yut_pool;
    
    bool double_buff_active = false;
    bool takeout_active = false;
    bool backstep_active = false;
    int saved_yut = 0;

    YutnoriBot() {
        for(int i=0; i<4; i++) { my_pos[i] = -1; opp_pos[i] = -1; }
        my_skill_left[0] = my_skill_left[1] = true;
        opp_skill_left[0] = opp_skill_left[1] = true;
        bomb_pos = 0; teleport_pos = 0;
    }

    void parse_init(const string& line) {
        stringstream ss(line); string cmd;
        ss >> cmd >> my_skills[0] >> my_skills[1] >> opp_skills[0] >> opp_skills[1];
    }

    void parse_time(const string& line) {
        stringstream ss(line); string cmd;
        ss >> cmd >> my_time >> opp_time;
        
        can_roll = true;
        rolled_this_turn = false;
        skill_used_this_turn = false;
        
        yut_pool.clear();
        if (saved_yut != 0) { yut_pool.push_back(saved_yut); saved_yut = 0; }
    }

    void parse_opp_logs(const string& line) {
        stringstream ss(line); string cmd; int count;
        ss >> cmd >> count;
        for (int i = 0; i < count; i++) {
            string log_line; getline(cin, log_line);
            apply_action(false, log_line);
        }
    }

    // ==========================================================
    // [유저 알고리즘 작성부]
    // ==========================================================
    void play_turn() {
        while (true) {
            // [행동 1] 스킬 사용 (굴리기 전)
            if (can_roll && !rolled_this_turn && !skill_used_this_turn) {
                if (my_skill_left[0]) {
                    // 예시: 8번 백스텝은 필드에 말이 있어야 함
                    if (my_skills[0] == 8) {
                        bool has_p = false;
                        for(int i=0; i<4; i++) if (my_pos[i] > 0) has_p = true;
                        if (has_p) { use_skill(my_skills[0], 0, 0); continue; }
                    } else {
                        use_skill(my_skills[0], 0, 0); 
                        continue;
                    }
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
                yut_pool.pop_back(); // [핵심 수정] 이동 가능 여부와 상관없이 무조건 윷 풀에서 먼저 꺼냄(버림)

                int target_pid = find_best_piece_to_move(yut);
                if (target_pid != -1) {
                    move_piece(target_pid, yut);
                } 
                continue; // 이동을 했든, 못해서 그냥 버려졌든 무조건 다음 행동(남은 윷 확인 등)으로 루프 재진입
            }

            pass_turn();
            break;
        }
    }

private:
    int find_best_piece_to_move(int yut_val) {
        int target_pid = -1;
        if (yut_val < 0) {
            for (int i = 0; i < 4; i++) { if (my_pos[i] > 0) { target_pid = i; break; } }
        } else {
            for (int i = 0; i < 4; i++) { if (my_pos[i] != 0) { target_pid = i; break; } }
        }
        return target_pid; // -1이면 이동 불가
    }

    // ==========================================================
    // 내부 통신 및 로컬 시뮬레이션 엔진 (수정 금지)
    // ==========================================================
    void use_skill(int skill_id, int param1, int param2) {
        cout << "SKILL " << skill_id;
        if (skill_id >= 9) cout << " " << param1 << " " << param2;
        cout << "\n" << flush;
        
        apply_action(true, "SKILL " + to_string(skill_id) + (skill_id >= 9 ? " " + to_string(param1) + " " + to_string(param2) : ""));
    }

    void roll_yut() {
        cout << "ROLL\n" << flush;
        string r_line; getline(cin, r_line); 
        stringstream r_ss(r_line); string dummy; int yut_val;
        r_ss >> dummy >> yut_val;
        apply_action(true, "ROLL " + to_string(yut_val));
    }

    void move_piece(int pid, int yut_val) {
        cout << "MOVE " << pid << " " << yut_val << "\n" << flush;
        apply_action(true, "MOVE " + to_string(pid) + " " + to_string(yut_val));
    }

    void pass_turn() {
        cout << "PASS\n" << flush;
    }

    void apply_action(bool is_mine, const string& log_line) {
        stringstream ss(log_line); string action; ss >> action;
        
        int* m_pos = is_mine ? my_pos : opp_pos;
        int* o_pos = is_mine ? opp_pos : my_pos;
        int* m_skills = is_mine ? my_skills : opp_skills;
        bool* m_s_left = is_mine ? my_skill_left : opp_skill_left;

        if (action == "SKILL") {
            if (is_mine) skill_used_this_turn = true;
            int id; ss >> id;
            if (id == m_skills[0]) m_s_left[0] = false; else m_s_left[1] = false;

            if (id >= 9) {
                int p1, p2; ss >> p1 >> p2;
                if(id==9) o_pos[p2%4]=-1;
                else if(id==10) { for(int i=0;i<4;i++){ if(m_pos[i]==-1){ m_pos[i]=m_pos[p1%4]; break; } } }
                else if(id==11) swap(m_pos[p1%4], o_pos[p2%4]);
                else if(id==12) o_pos[p2%4] = step_forward(m_pos[p1%4], false);
                else if(id==13) m_pos[p1%4] = step_backward(o_pos[p2%4]);
                else if(id==14) teleport_pos = p1;
                else if(id==15) bomb_pos = p1;
            } else {
                if (is_mine) {
                    if (id == 1) { yut_pool.push_back(1); yut_pool.push_back(2); can_roll = false; }
                    else if (id == 2) { yut_pool.push_back(3); can_roll = false; }
                    else if (id == 3) { yut_pool.push_back(-1); can_roll = false; }
                    else if (id == 4) double_buff_active = true;
                    else if(id==7){ takeout_active = true; }
                    else if(id==8){ backstep_active = true; }
                }
            }
        } else if (action == "ROLL") {
            if (is_mine) {
                rolled_this_turn = true;
                can_roll = false; // [핵심 수정] 윷을 굴렸으므로 기본 굴리기 권한 소모!
            }
            int y; ss >> y;
            if (is_mine) {
                // 윷/모(4, 5)가 나오면 한 번 더 굴리는 룰을 takeout에도 정상 적용
                if (takeout_active) { saved_yut = y; takeout_active = false; if(y>=4) can_roll = true; }
                else if (backstep_active) { yut_pool.push_back(-abs(y)); backstep_active = false; if(y>=4) can_roll = true; }
                else if (double_buff_active) { yut_pool.push_back(y); yut_pool.push_back(y); double_buff_active = false; if(y>=4) can_roll = true; }
                else { yut_pool.push_back(y); if(y>=4) can_roll = true; }
            }
        } else if (action == "MOVE") {
            int pid, y; ss >> pid >> y;
            int u = m_pos[pid], start_pos = u;
            
            vector<int> stacked; for(int i=0;i<4;i++) if(m_pos[i]==u && u!=-1) stacked.push_back(i);
            if (stacked.empty()) stacked.push_back(pid);

            if (y > 0) for(int i=0;i<y;i++) u = step_forward(u, i==0);
            else if (y < 0) for(int i=0;i<-y;i++) u = step_backward(u);

            if (bomb_pos > 0 && ((y>0 && start_pos<=bomb_pos && u>=bomb_pos) || (y<0 && start_pos>=bomb_pos && u<=bomb_pos))) {
                u = -1; bomb_pos = 0;
            } else if (teleport_pos > 0 && u == teleport_pos) {
                u = 0; teleport_pos = 0;
            }
            
            for (int i : stacked) m_pos[i] = u;

            if (u > 0 && u < 20) {
                bool caught = false;
                for(int i=0;i<4;i++) if(o_pos[i]==u) { o_pos[i]=-1; caught=true; }
                if (is_mine && caught) can_roll = true;
            }
        }
    }

    int step_forward(int u, bool first) {
        if (u == -1) return 1; if (u == 0) return 0; 
        if (first&&u==5) return 21; if (first&&u==10) return 24; if (first&&u==23) return 26;
        if (u==19||u==27) return 0;
        if (u==21) return 22; if (u==22) return 23; if (u==24) return 25; if (u==25) return 23; if (u==26) return 27;
        return u + 1;
    }

    int step_backward(int u) {
        if (u == -1 || u == 0) return u; if (u == 1) return 0;
        if (u==21) return 5; if (u==22) return 21; if (u==23) return 22;
        if (u==24) return 10; if (u==25) return 24; if (u==26) return 23; if (u==27) return 26;
        return u - 1;
    }
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    YutnoriBot bot; string line;
    while (getline(cin, line)) {
        if (line.empty()) continue;
        stringstream ss(line); string cmd; ss >> cmd;

        if (cmd == "READY") { cout << "OK\n" << flush; } 
        else if (cmd == "INIT") { bot.parse_init(line); } 
        else if (cmd == "TIME") { bot.parse_time(line); bot.play_turn(); } 
        else if (cmd == "OPP") { bot.parse_opp_logs(line); }
        else if (cmd == "FINISH") { break; }
    }
    return 0;
}