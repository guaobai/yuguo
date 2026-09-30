package cn.iocoder.yudao.module.member.service.auth;

import cn.iocoder.yudao.framework.common.biz.system.oauth2.OAuth2TokenCommonApi;
import cn.iocoder.yudao.framework.common.biz.system.oauth2.dto.OAuth2AccessTokenRespDTO;
import cn.iocoder.yudao.framework.common.enums.CommonStatusEnum;
import cn.iocoder.yudao.framework.common.enums.UserTypeEnum;
import cn.iocoder.yudao.framework.test.core.ut.BaseMockitoUnitTest;
import cn.iocoder.yudao.module.member.controller.app.auth.vo.AppAuthLoginRespVO;
import cn.iocoder.yudao.module.member.controller.app.auth.vo.AppAuthSocialLoginReqVO;
import cn.iocoder.yudao.module.member.dal.dataobject.user.MemberUserDO;
import cn.iocoder.yudao.module.member.service.user.MemberUserService;
import cn.iocoder.yudao.module.system.api.logger.LoginLogApi;
import cn.iocoder.yudao.module.system.api.social.SocialUserApi;
import cn.iocoder.yudao.module.system.api.social.dto.SocialUserRespDTO;
import cn.iocoder.yudao.module.system.enums.logger.LoginResultEnum;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;

import java.time.LocalDateTime;

import static cn.iocoder.yudao.framework.common.exception.util.ServiceExceptionUtil.exception;
import static cn.iocoder.yudao.framework.test.core.util.AssertUtils.assertServiceException;
import static cn.iocoder.yudao.module.member.enums.ErrorCodeConstants.*;
import static cn.iocoder.yudao.module.system.enums.ErrorCodeConstants.SOCIAL_USER_ALREADY_BOUND;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 微信 H5 的明确注册策略与现有小程序登录兼容性。全程使用模拟身份，不调用微信。 */
public class MemberWechatAuthServiceTest extends BaseMockitoUnitTest {

    @InjectMocks
    private MemberAuthServiceImpl authService;
    @Mock
    private MemberUserService userService;
    @Mock
    private SocialUserApi socialUserApi;
    @Mock
    private OAuth2TokenCommonApi oauth2TokenApi;
    @Mock
    private LoginLogApi loginLogApi;

    @Test
    public void officialAccountWithoutBindingDoesNotCreateUserOrToken() {
        AppAuthSocialLoginReqVO req = request(31, null);
        mockSocial(req, null);

        AppAuthLoginRespVO result = authService.socialLogin(req);
        assertEquals(Boolean.TRUE, result.getBindRequired());
        assertNull(result.getAccessToken());
        assertNull(result.getUserId());
        verifyNoInteractions(userService, oauth2TokenApi, loginLogApi);
        verify(socialUserApi, never()).bindSocialUser(any());
    }

    @Test
    public void officialAccountExplicitRegistrationCreatesAndBindsUser() {
        AppAuthSocialLoginReqVO req = request(31, true);
        mockSocial(req, null);
        MemberUserDO member = member(101L, true);
        when(userService.createUser(eq("测试微信"), eq("avatar"), any(), any())).thenReturn(member);
        mockToken(member.getId());

        AppAuthLoginRespVO result = authService.socialLogin(req);

        assertEquals(member.getId(), result.getUserId());
        assertEquals("test-access-token", result.getAccessToken());
        assertEquals("test-openid", result.getOpenid());
        verify(socialUserApi).bindSocialUser(argThat(binding ->
                binding.getUserId().equals(member.getId()) && binding.getSocialType() == 31
                        && binding.getUserType().equals(UserTypeEnum.MEMBER.getValue())));
    }

    @Test
    public void miniProgramStillCreatesItsFirstMemberWithoutNewFlag() {
        AppAuthSocialLoginReqVO req = request(34, false);
        mockSocial(req, null);
        MemberUserDO member = member(102L, true);
        when(userService.createUser(any(), any(), any(), any())).thenReturn(member);
        mockToken(member.getId());

        assertEquals(member.getId(), authService.socialLogin(req).getUserId());
        verify(socialUserApi).bindSocialUser(argThat(binding -> binding.getSocialType() == 34));
    }

    @ParameterizedTest
    @ValueSource(ints = {31, 34})
    public void existingBindingAlwaysKeepsOriginalMember(int type) {
        AppAuthSocialLoginReqVO req = request(type, true);
        mockSocial(req, 88L);
        when(userService.getUser(88L)).thenReturn(member(88L, true));
        mockToken(88L);

        assertEquals(88L, authService.socialLogin(req).getUserId().longValue());
        verify(userService, never()).createUser(any(), any(), any(), any());
        verify(socialUserApi, never()).bindSocialUser(any());
    }

    @ParameterizedTest
    @ValueSource(ints = {31, 34})
    public void disabledMemberCannotUseSocialLogin(int type) {
        AppAuthSocialLoginReqVO req = request(type, false);
        mockSocial(req, 88L);
        when(userService.getUser(88L)).thenReturn(member(88L, false));

        assertServiceException(() -> authService.socialLogin(req), AUTH_LOGIN_USER_DISABLED);

        verifyNoInteractions(oauth2TokenApi);
        verify(loginLogApi).createLoginLog(argThat(log ->
                LoginResultEnum.USER_DISABLED.getResult().equals(log.getResult())));
    }

    @Test
    public void deletedBoundMemberCannotReceiveToken() {
        AppAuthSocialLoginReqVO req = request(31, false);
        mockSocial(req, 88L);
        assertServiceException(() -> authService.socialLogin(req), USER_NOT_EXISTS);
        verifyNoInteractions(oauth2TokenApi);
    }

    @Test
    public void authorizationFailureDoesNotCreateMember() {
        assertServiceException(() -> authService.socialLogin(request(31, true)), AUTH_SOCIAL_USER_NOT_FOUND);
        verifyNoInteractions(userService, oauth2TokenApi);
    }

    @Test
    public void concurrentBindingConflictDoesNotIssueToken() {
        AppAuthSocialLoginReqVO req = request(31, true);
        mockSocial(req, null);
        when(userService.createUser(any(), any(), any(), any())).thenReturn(member(101L, true));
        when(socialUserApi.bindSocialUser(any())).thenThrow(exception(SOCIAL_USER_ALREADY_BOUND));

        assertServiceException(() -> authService.socialLogin(req), SOCIAL_USER_ALREADY_BOUND);
        verifyNoInteractions(oauth2TokenApi);
    }

    private AppAuthSocialLoginReqVO request(int type, Boolean createUser) {
        return AppAuthSocialLoginReqVO.builder().type(type).code("test-code")
                .state("test-state").createUser(createUser).build();
    }

    private void mockSocial(AppAuthSocialLoginReqVO req, Long userId) {
        when(socialUserApi.getSocialUserByCode(UserTypeEnum.MEMBER.getValue(), req.getType(),
                req.getCode(), req.getState()))
                .thenReturn(new SocialUserRespDTO("test-openid", "测试微信", "avatar", userId));
    }

    private MemberUserDO member(Long id, boolean enabled) {
        return new MemberUserDO().setId(id).setUsername("member" + id)
                .setStatus(enabled ? CommonStatusEnum.ENABLE.getStatus() : CommonStatusEnum.DISABLE.getStatus());
    }

    private void mockToken(Long userId) {
        when(oauth2TokenApi.createAccessToken(argThat(request -> userId.equals(request.getUserId()))))
                .thenReturn(new OAuth2AccessTokenRespDTO().setUserId(userId)
                        .setAccessToken("test-access-token").setRefreshToken("test-refresh-token")
                        .setExpiresTime(LocalDateTime.of(2030, 1, 1, 0, 0)));
    }
}
