package cn.iocoder.yudao.module.member.service.auth;

import cn.iocoder.yudao.framework.common.enums.CommonStatusEnum;
import cn.iocoder.yudao.framework.common.biz.system.oauth2.dto.OAuth2AccessTokenRespDTO;
import cn.iocoder.yudao.framework.common.util.collection.ArrayUtils;
import cn.iocoder.yudao.framework.redis.config.YudaoRedisAutoConfiguration;
import cn.iocoder.yudao.framework.test.core.ut.BaseDbAndRedisUnitTest;
import cn.iocoder.yudao.module.member.controller.app.auth.vo.AppAuthRegisterReqVO;
import cn.iocoder.yudao.module.member.controller.app.auth.vo.AppAuthUsernameLoginReqVO;
import cn.iocoder.yudao.module.member.dal.dataobject.user.MemberUserDO;
import cn.iocoder.yudao.module.member.dal.mysql.user.MemberUserMapper;
import cn.iocoder.yudao.module.member.service.user.MemberUserService;
import cn.iocoder.yudao.module.system.api.logger.LoginLogApi;
import cn.iocoder.yudao.framework.common.biz.system.oauth2.OAuth2TokenCommonApi;
import cn.iocoder.yudao.module.system.api.sms.SmsCodeApi;
import cn.iocoder.yudao.module.system.api.social.SocialClientApi;
import cn.iocoder.yudao.module.system.api.social.SocialUserApi;
import cn.iocoder.yudao.module.system.enums.logger.LoginLogTypeEnum;
import cn.iocoder.yudao.module.system.enums.logger.LoginResultEnum;
import com.anji.captcha.model.common.ResponseModel;
import com.anji.captcha.service.CaptchaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.annotation.Resource;
import java.util.function.Consumer;

import static cn.hutool.core.util.RandomUtil.randomEle;
import static cn.iocoder.yudao.framework.common.exception.util.ServiceExceptionUtil.exception;
import static cn.iocoder.yudao.framework.test.core.util.AssertUtils.assertPojoEquals;
import static cn.iocoder.yudao.framework.test.core.util.AssertUtils.assertServiceException;
import static cn.iocoder.yudao.framework.test.core.util.RandomUtils.randomPojo;
import static cn.iocoder.yudao.framework.test.core.util.RandomUtils.randomString;
import static cn.iocoder.yudao.module.member.enums.ErrorCodeConstants.AUTH_LOGIN_CAPTCHA_CODE_ERROR;
import static cn.iocoder.yudao.module.member.enums.ErrorCodeConstants.USER_USERNAME_USED;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// TODO @芋艿：单测的 review，等逻辑都达成一致后
/**
 * {@link MemberAuthService} 的单元测试类
 *
 * @author 宋天
 */
@Import({MemberAuthServiceImpl.class, YudaoRedisAutoConfiguration.class})
public class MemberAuthServiceTest extends BaseDbAndRedisUnitTest {

    // TODO @芋艿：登录相关的单测，待补全

    @Resource
    private MemberAuthServiceImpl authService;

    @MockBean
    private MemberUserService userService;
    @MockBean
    private SmsCodeApi smsCodeApi;
    @MockBean
    private LoginLogApi loginLogApi;
    @MockBean
    private OAuth2TokenCommonApi oauth2TokenApi;
    @MockBean
    private SocialUserApi socialUserApi;
    @MockBean
    private SocialClientApi socialClientApi;
    @MockBean
    private CaptchaService captchaService;
    @MockBean
    private PasswordEncoder passwordEncoder;

    @Resource
    private MemberUserMapper memberUserMapper;

    @BeforeEach
    public void setUp() {
        authService.setCaptchaEnable(true);
    }

    @Test
    public void testUsernameLogin_successAndNormalize() {
        AppAuthUsernameLoginReqVO reqVO = new AppAuthUsernameLoginReqVO();
        reqVO.setUsername(" Test_User ");
        reqVO.setPassword("password1");
        reqVO.setCaptchaVerification("captcha-verification");
        when(captchaService.verification(argThat(captcha ->
                reqVO.getCaptchaVerification().equals(captcha.getCaptchaVerification()))))
                .thenReturn(ResponseModel.success());
        MemberUserDO user = randomUserDO(o -> o.setId(1L).setUsername("test_user")
                .setPassword("encoded-password").setStatus(CommonStatusEnum.ENABLE.getStatus()));
        when(userService.getUserByUsername(eq("test_user"))).thenReturn(user);
        when(userService.isPasswordMatch(eq(reqVO.getPassword()), eq(user.getPassword()))).thenReturn(true);
        OAuth2AccessTokenRespDTO token = randomPojo(OAuth2AccessTokenRespDTO.class,
                o -> o.setUserId(user.getId()));
        when(oauth2TokenApi.createAccessToken(argThat(request ->
                request.getUserId().equals(user.getId())))).thenReturn(token);

        assertPojoEquals(token, authService.usernameLogin(reqVO));

        verify(loginLogApi).createLoginLog(argThat(log -> "test_user".equals(log.getUsername())
                && LoginLogTypeEnum.LOGIN_USERNAME.getType().equals(log.getLogType())
                && LoginResultEnum.SUCCESS.getResult().equals(log.getResult())));
    }

    @Test
    public void testUsernameLogin_captchaRejected() {
        AppAuthUsernameLoginReqVO reqVO = new AppAuthUsernameLoginReqVO();
        reqVO.setUsername("test_user");
        reqVO.setPassword("password1");
        reqVO.setCaptchaVerification("invalid-captcha");
        when(captchaService.verification(any())).thenReturn(ResponseModel.errorMsg("滑块位置不正确"));

        assertServiceException(() -> authService.usernameLogin(reqVO),
                AUTH_LOGIN_CAPTCHA_CODE_ERROR, "滑块位置不正确");

        verify(userService, never()).getUserByUsername(any());
        verify(loginLogApi).createLoginLog(argThat(log -> "test_user".equals(log.getUsername())
                && LoginResultEnum.CAPTCHA_CODE_ERROR.getResult().equals(log.getResult())));
    }

    @Test
    public void testRegister_duplicateUsername() {
        AppAuthRegisterReqVO reqVO = new AppAuthRegisterReqVO();
        reqVO.setUsername(" Existing_User ");
        reqVO.setPassword("password1");
        reqVO.setConfirmPassword("password1");
        reqVO.setCaptchaVerification("captcha-verification");
        when(captchaService.verification(any())).thenReturn(ResponseModel.success());
        when(userService.createUserByUsername(eq("existing_user"), eq(reqVO.getPassword()),
                any(), any())).thenThrow(exception(USER_USERNAME_USED, "existing_user"));

        assertServiceException(() -> authService.register(reqVO), USER_USERNAME_USED, "existing_user");

        verify(oauth2TokenApi, never()).createAccessToken(any());
    }

    // TODO 芋艿：后续重构这个单测
//    @Test
//    public void testUpdatePassword_success(){
//        // 准备参数
//        MemberUserDO userDO = randomUserDO();
//        memberUserMapper.insert(userDO);
//
//        // 新密码
//        String newPassword = randomString();
//
//        // 请求实体
//        AppMemberUserUpdatePasswordReqVO reqVO = AppMemberUserUpdatePasswordReqVO.builder()
//                .oldPassword(userDO.getPassword())
//                .password(newPassword)
//                .build();
//
//        // 测试桩
//        // 这两个相等是为了返回ture这个结果
//        when(passwordEncoder.matches(reqVO.getOldPassword(),reqVO.getOldPassword())).thenReturn(true);
//        when(passwordEncoder.encode(newPassword)).thenReturn(newPassword);
//
//        // 更新用户密码
//        authService.updatePassword(userDO.getId(), reqVO);
//        assertEquals(memberUserMapper.selectById(userDO.getId()).getPassword(),newPassword);
//    }

    // TODO 芋艿：后续重构这个单测
//    @Test
//    public void testResetPassword_success(){
//        // 准备参数
//        MemberUserDO userDO = randomUserDO();
//        memberUserMapper.insert(userDO);
//
//        // 随机密码
//        String password = randomNumbers(11);
//        // 随机验证码
//        String code = randomNumbers(4);
//
//        // mock
//        when(passwordEncoder.encode(password)).thenReturn(password);
//
//        // 更新用户密码
//        AppMemberUserResetPasswordReqVO reqVO = new AppMemberUserResetPasswordReqVO();
//        reqVO.setMobile(userDO.getMobile());
//        reqVO.setPassword(password);
//        reqVO.setCode(code);
//
//        authService.resetPassword(reqVO);
//        assertEquals(memberUserMapper.selectById(userDO.getId()).getPassword(),password);
//    }

    // ========== 随机对象 ==========

    @SafeVarargs
    private static MemberUserDO randomUserDO(Consumer<MemberUserDO>... consumers) {
        Consumer<MemberUserDO> consumer = (o) -> {
            o.setStatus(randomEle(CommonStatusEnum.values()).getStatus()); // 保证 status 的范围
            o.setPassword(randomString());
        };
        return randomPojo(MemberUserDO.class, ArrayUtils.append(consumer, consumers));
    }


}
